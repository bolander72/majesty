#!/usr/bin/env python3
"""Bounded, self-hostable DirectPlay-over-WebSocket room relay (protocol v1).

Requires websockets==15.0.1. Local: scripts/room_relay.py --port 8002
HTTPS deployments must proxy /rooms with TLS and set --origin to their client.
The relay owns identities/ordering; guest game packets remain opaque.
"""
import argparse
import asyncio
from dataclasses import dataclass, field
import logging
import re
import struct
import time
import uuid

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

MAGIC, VERSION = 0x31525044, 1
HEADER = struct.Struct('<5I')
HELLO, LIST, CREATE, JOIN, PLAYER, SEND, LEAVE, SESSION, DATA, NAME, DESTROY = range(1, 12)
SESSION_EVENT, PLAYER_EVENT, DESTROY_EVENT, DATA_EVENT, NAME_EVENT, PACKET_EVENT, LOST_EVENT = range(101, 108)
SEND_ACK = 108
BARRIER, BARRIER_EVENT = 12, 109
BARRIER_CONTRACT = b'checkpoint-transition-v1'
BARRIER_ENABLE, BARRIER_BEGIN, BARRIER_READY, BARRIER_LOADED, BARRIER_CANCEL = range(5)
BARRIER_PREPARED, BARRIER_COMMITTED, BARRIER_COMPLETE, BARRIER_CANCELED = range(1, 5)
BARRIER_SECONDS, BARRIER_DESCRIPTOR_BYTES = 30, 1024
CHECKPOINT, CHECKPOINT_EVENT = 13, 110
CHECKPOINT_REQUEST, CHECKPOINT_OFFER, CHECKPOINT_CHUNK, CHECKPOINT_ACK, CHECKPOINT_END, CHECKPOINT_END_ACK = range(6)
CHECKPOINT_ENABLE, CHECKPOINT_CONTRACT = 6, b'checkpoint-delivery-v1'
CHECKPOINT_CHUNK_BYTES, CHECKPOINT_MAX_BYTES, CHECKPOINT_SECONDS = 16384, 64 * 1024 * 1024, 600
REPLY = 0x80000000
INVALID, ACCESS, NO_SESSION, FULL, PASSWORD, CLOSED = 0x80070057, 0x8877000a, 0x887700dc, 0x88770028, 0x88770154, 0x8877014a
LIMIT, QUEUE_BYTES = 66560, 2 * 1024 * 1024
QUEUE_MESSAGES = 4096


def word(data, offset=0):
    return struct.unpack_from('<I', data, offset)[0]


def put(*words):
    return struct.pack('<' + 'I' * len(words), *words)


def string(data):
    if isinstance(data, str):
        data = data.encode('latin-1')
    return put(len(data)) + data


class Reader:
    def __init__(self, data):
        self.data, self.at = data, 0

    def take(self, size):
        if size < 0 or size > len(self.data) - self.at:
            raise ValueError('truncated packet')
        out = self.data[self.at:self.at + size]
        self.at += size
        return out

    def u32(self):
        return word(self.take(4))

    def string(self, limit=255):
        size = self.u32()
        if size > limit:
            raise ValueError('oversized string')
        out = self.take(size)
        if b'\0' in out:
            raise ValueError('embedded NUL')
        return out

    def done(self):
        if self.at != len(self.data):
            raise ValueError('trailing bytes')


@dataclass
class Session:
    desc: bytearray
    name: bytes
    password: bytes

    @classmethod
    def read(cls, r):
        desc = bytearray(r.take(80))
        name, password = r.string(), r.string(64)
        if word(desc) != 80 or word(desc, 48) or word(desc, 52):
            raise ValueError('invalid session structure')
        return cls(desc, name, password)

    def encode(self, hide_password=False):
        return bytes(self.desc) + string(self.name) + string(b'' if hide_password else self.password)

    def patch(self, offset, value):
        struct.pack_into('<I', self.desc, offset, value)


@dataclass
class Player:
    id: int
    flags: int
    short: bytes
    long: bytes
    data: bytes

    @classmethod
    def read(cls, r):
        pid, flags, short, long = r.u32(), r.u32(), r.string(), r.string()
        n = r.u32()
        if n > 65536 or flags & ~0x300:
            raise ValueError('invalid player')
        return cls(pid, flags, short, long, r.take(n))

    def encode(self):
        return put(self.id, self.flags) + string(self.short) + string(self.long) + string(self.data)


@dataclass(eq=False)
class Peer:
    socket: object
    manifest: bytes = b''
    room: object = None
    player: object = None
    outgoing: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=QUEUE_MESSAGES))
    bytes: int = 0
    rx: int = 0
    tx: int = 0
    request: int = 0
    barrier_enabled: bool = False
    checkpoint_enabled: bool = False

    def enqueue(self, op, body=b'', request=0, status=0):
        packet = HEADER.pack(MAGIC, VERSION, op, request, status) + body
        if len(packet) > LIMIT or self.outgoing.full() or self.bytes + len(packet) > QUEUE_BYTES:
            raise ValueError('outgoing queue full')
        self.bytes += len(packet)
        self.outgoing.put_nowait(packet)

    async def write(self):
        while True:
            packet = await self.outgoing.get()
            try:
                await asyncio.wait_for(self.socket.send(packet), 10)
            except (ConnectionClosed, asyncio.TimeoutError):
                await self.socket.close(1011, 'Transport failed')
                return
            self.bytes -= len(packet)


@dataclass
class CheckpointDelivery:
    # Scalar progress only. One outstanding event per recipient; its data is
    # owned by the bounded socket queue, never copied into a retained save.
    total: int = 0
    forwarded: int = 0
    next_sequence: int = 1
    waiting: object = None
    waiting_action: int = 0
    completed: bool = False


@dataclass
class CheckpointBarrier:
    # One bounded proposal per room. The relay authenticates roster/ordering;
    # game clients must validate paused frame, region/seed/rules and actual save
    # bytes before READY, and native load completion before LOADED.
    serial: int
    descriptor: bytes
    players: tuple
    ready: set = field(default_factory=set)
    loaded: set = field(default_factory=set)
    committed: bool = False
    deadline: float = 0
    timer: object = None
    deliveries: dict = field(default_factory=dict)
    transfer_deadline: float = 0


@dataclass
class Room:
    session: Session
    manifest: bytes
    host: Peer
    members: list = field(default_factory=list)
    players: dict = field(default_factory=dict)
    next_player: int = 2
    barrier_serial: int = 0
    barrier: object = None

    def roster(self):
        self.session.patch(44, len(self.players))
        return self.session.encode(True) + put(len(self.players)) + b''.join(p.encode() for p in self.players.values())

    def event(self, op, body=b'', exclude=None):
        for peer in self.members:
            if peer is not exclude:
                peer.enqueue(op, body)


class Relay:
    def __init__(self):
        self.rooms = {}
        self.peers = set()

    def clear_barrier(self, room):
        barrier, room.barrier = room.barrier, None
        if barrier and barrier.timer:
            barrier.timer.cancel()
        if barrier:
            barrier.deliveries.clear()

    def barrier_event(self, room, stage):
        barrier = room.barrier
        room.event(BARRIER_EVENT, put(barrier.serial, stage) + string(barrier.descriptor)
                   + put(len(barrier.players), *barrier.players))

    def arm_barrier(self, room):
        barrier = room.barrier
        barrier.deadline = time.monotonic() + BARRIER_SECONDS
        if barrier.transfer_deadline and not barrier.committed:
            barrier.deadline = min(barrier.deadline, barrier.transfer_deadline)
        if barrier.timer:
            barrier.timer.cancel()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # Direct dispatch tests have no loop. Their next dispatch still
            # checks the same deadline; the live service always arms a timer.
            return
        barrier.timer = loop.call_later(max(0, barrier.deadline - time.monotonic()),
                                        self.expire_barrier, room, barrier)

    def checkpoint_progress(self, room):
        barrier = room.barrier
        if not barrier.transfer_deadline:
            barrier.transfer_deadline = time.monotonic() + CHECKPOINT_SECONDS
        # Only accepted requests/acknowledgements call this. Duplicate traffic
        # cannot keep a stalled transfer alive, and the total deadline is fixed.
        self.arm_barrier(room)

    def dispatch_checkpoint(self, p, r):
        room, action, serial = p.room, r.u32(), r.u32()
        barrier = room.barrier
        if action == CHECKPOINT_ENABLE:
            contract = r.string(64)
            r.done()
            if (serial or contract != CHECKPOINT_CONTRACT or barrier or
                    not p.barrier_enabled or not p.player or
                    room.players.get(p.player.id) is not p.player):
                return ACCESS, b''
            p.checkpoint_enabled = True
            return 0, put(1)
        if (not p.barrier_enabled or not p.player or
                not p.checkpoint_enabled or not room.host.checkpoint_enabled or
                room.players.get(p.player.id) is not p.player or
                not barrier or barrier.committed or serial != barrier.serial or
                p.player.id not in barrier.players or not room.host.player):
            return CLOSED, b''
        host_id = room.host.player.id
        if action == CHECKPOINT_REQUEST:
            descriptor = r.string(BARRIER_DESCRIPTOR_BYTES)
            r.done()
            if p is room.host or descriptor != barrier.descriptor:
                return ACCESS, b''
            if p.player.id in barrier.ready or p.player.id in barrier.deliveries:
                return CLOSED, b''
            room.host.enqueue(CHECKPOINT_EVENT, put(action, serial, p.player.id, host_id))
            barrier.deliveries[p.player.id] = CheckpointDelivery()
            self.checkpoint_progress(room)
            return 0, b''
        recipient = r.u32()
        if action in (CHECKPOINT_OFFER, CHECKPOINT_CHUNK, CHECKPOINT_END):
            if p is not room.host or recipient == host_id or recipient in barrier.ready:
                return ACCESS, b''
            target = next((peer for peer in room.members
                           if peer.player and peer.player.id == recipient), None)
            transfer = barrier.deliveries.get(recipient)
            if (not target or not target.checkpoint_enabled or not target.barrier_enabled or
                    not transfer or transfer.completed or transfer.waiting is not None):
                return CLOSED, b''
            if action == CHECKPOINT_OFFER:
                total = r.u32()
                r.done()
                if transfer.total or not 1 <= total <= CHECKPOINT_MAX_BYTES:
                    return INVALID, b''
                target.enqueue(CHECKPOINT_EVENT, put(action, serial, host_id, recipient, total))
                transfer.total, transfer.waiting, transfer.waiting_action = total, 0, action
            elif action == CHECKPOINT_CHUNK:
                sequence, size = r.u32(), r.u32()
                if (not transfer.total or sequence != transfer.next_sequence or
                        not size or
                        size != min(CHECKPOINT_CHUNK_BYTES, transfer.total - transfer.forwarded)):
                    return INVALID, b''
                data = r.take(size)
                r.done()
                target.enqueue(CHECKPOINT_EVENT,
                               put(action, serial, host_id, recipient, sequence, size) + data)
                transfer.forwarded += size
                transfer.next_sequence += 1
                transfer.waiting, transfer.waiting_action = sequence, action
            else:
                sequence = r.u32()
                r.done()
                if (not transfer.total or transfer.forwarded != transfer.total or
                        sequence != transfer.next_sequence):
                    return INVALID, b''
                target.enqueue(CHECKPOINT_EVENT, put(action, serial, host_id, recipient, sequence))
                transfer.waiting, transfer.waiting_action = sequence, action
            return 0, b''
        if action in (CHECKPOINT_ACK, CHECKPOINT_END_ACK):
            sequence = r.u32()
            r.done()
            transfer = barrier.deliveries.get(p.player.id)
            if (p is room.host or recipient != host_id or not transfer or
                    transfer.completed or transfer.waiting != sequence or
                    transfer.waiting_action not in
                    ((CHECKPOINT_END,) if action == CHECKPOINT_END_ACK
                     else (CHECKPOINT_OFFER, CHECKPOINT_CHUNK))):
                return CLOSED, b''
            room.host.enqueue(CHECKPOINT_EVENT, put(action, serial, p.player.id, host_id, sequence))
            transfer.waiting = None
            if action == CHECKPOINT_END_ACK:
                transfer.completed = True
            self.checkpoint_progress(room)
            return 0, b''
        return INVALID, b''

    def expire_barrier(self, room, barrier):
        if room.barrier is not barrier:
            return
        if barrier.committed:
            # After load permission, some peers may already have left the old
            # world. A missing peer cannot safely become a smaller live party.
            self.end_room(room)
        else:
            try:
                self.barrier_event(room, BARRIER_CANCELED)
                self.clear_barrier(room)
            except ValueError:
                self.end_room(room)

    def dispatch_barrier(self, p, r):
        room, action = p.room, r.u32()
        if not p.player or room.players.get(p.player.id) is not p.player:
            return ACCESS, b''
        if action == BARRIER_ENABLE:
            contract = r.string(64)
            r.done()
            if contract != BARRIER_CONTRACT or room.barrier:
                return INVALID, b''
            p.barrier_enabled = True
            return 0, put(1)
        serial = r.u32()
        descriptor = r.string(BARRIER_DESCRIPTOR_BYTES)
        r.done()
        if not p.barrier_enabled or not serial or not descriptor:
            return ACCESS, b''
        if action == BARRIER_BEGIN:
            if p is not room.host:
                return ACCESS, b''
            if room.barrier or serial != room.barrier_serial + 1:
                return CLOSED, b''
            members = room.members
            if not 2 <= len(members) <= 4 or any(not peer.player or not peer.barrier_enabled for peer in members):
                return ACCESS, b''
            players = tuple(sorted(peer.player.id for peer in members))
            if len(set(players)) != len(members) or set(players) != set(room.players):
                return ACCESS, b''
            room.barrier = CheckpointBarrier(serial, descriptor, players)
            room.barrier_serial = serial
            self.arm_barrier(room)
            self.barrier_event(room, BARRIER_PREPARED)
            return 0, b''
        barrier = room.barrier
        if not barrier or serial != barrier.serial or descriptor != barrier.descriptor:
            return CLOSED, b''
        if p.player.id not in barrier.players:
            return ACCESS, b''
        if action == BARRIER_CANCEL:
            if barrier.committed:
                self.end_room(room)
            else:
                self.barrier_event(room, BARRIER_CANCELED)
                self.clear_barrier(room)
            return 0, b''
        if action == BARRIER_READY:
            transfer = barrier.deliveries.get(p.player.id)
            if transfer and not transfer.completed:
                return CLOSED, b''
            if not barrier.committed:
                barrier.ready.add(p.player.id)
                if len(barrier.ready) == len(barrier.players):
                    barrier.committed = True
                    self.arm_barrier(room)
                    self.barrier_event(room, BARRIER_COMMITTED)
            return 0, b''
        if action == BARRIER_LOADED:
            if not barrier.committed:
                return CLOSED, b''
            barrier.loaded.add(p.player.id)
            if len(barrier.loaded) == len(barrier.players):
                self.barrier_event(room, BARRIER_COMPLETE)
                self.clear_barrier(room)
            return 0, b''
        return INVALID, b''

    def end_room(self, room, leaving=None):
        self.clear_barrier(room)
        self.rooms.pop(bytes(room.session.desc[8:24]), None)
        members = room.members[:]
        room.members.clear()
        for p in members:
            p.room, p.player = None, None
            p.barrier_enabled = False
            p.checkpoint_enabled = False
            if p is leaving:
                continue
            try:
                p.enqueue(LOST_EVENT)
            except ValueError:
                # Even a saturated peer is detached. Its transport is closed
                # instead of leaving an orphaned, half-terminated room.
                if p.socket:
                    asyncio.create_task(p.socket.close(1011, 'Session queue full'))

    def depart(self, p):
        if p.room:
            # First protocol has no host migration or packet replay. A broken
            # link terminates the session rather than continuing divergent play.
            self.end_room(p.room, leaving=p)

    def dispatch(self, p, op, body):
        if p.room and p.room.barrier:
            barrier, now = p.room.barrier, time.monotonic()
            if (now >= barrier.deadline or
                    (not barrier.committed and barrier.transfer_deadline and
                     now >= barrier.transfer_deadline)):
                self.expire_barrier(p.room, barrier)
        r = Reader(body)
        if op == HELLO:
            manifest = r.string(255)
            r.done()
            if p.manifest or not re.fullmatch(rb'[0-9a-f]{64}:[0-9a-f]{64}:[0-9a-f]{64}', manifest):
                return INVALID, b''
            p.manifest = manifest
            return 0, b''
        if not p.manifest:
            return ACCESS, b''
        if op == LIST:
            app, flags = r.take(16), r.u32()
            r.done()
            rooms = [room for room in self.rooms.values() if room.manifest == p.manifest
                     and (app == bytes(16) or app == room.session.desc[24:40])
                     and (flags & 2 or not word(room.session.desc, 4) & 0x21)
                     and (flags & 2 or len(room.players) < word(room.session.desc, 40))]
            return 0, put(len(rooms)) + b''.join(room.session.encode(True) for room in rooms)
        if op in (CREATE, JOIN):
            session = Session.read(r)
            r.done()
            if p.room:
                return ACCESS, b''
            if op == CREATE:
                if len(self.rooms) >= 64 or not 1 <= word(session.desc, 40) <= 16:
                    return FULL, b''
                session.desc[8:24] = uuid.uuid4().bytes_le
                session.patch(44, 0)
                room = Room(session, p.manifest, p, [p])
                self.rooms[bytes(session.desc[8:24])] = room
                logging.info('Created room %s', uuid.UUID(bytes_le=bytes(session.desc[8:24])))
            else:
                room = self.rooms.get(bytes(session.desc[8:24]))
                if not room or room.manifest != p.manifest or session.desc[24:40] != bytes(16) and room.session.desc[24:40] != session.desc[24:40]:
                    return NO_SESSION, b''
                if word(room.session.desc, 4) & 0x21:
                    return CLOSED, b''
                if room.barrier:
                    return CLOSED, b''
                if len(room.members) >= word(room.session.desc, 40):
                    return FULL, b''
                if session.password != room.session.password:
                    return PASSWORD, b''
                room.members.append(p)
                logging.info('Joined room; %d connections', len(room.members))
            p.room = room
            return 0, room.roster()
        room = p.room
        if not room:
            return NO_SESSION, b''
        if op == BARRIER:
            return self.dispatch_barrier(p, r)
        if op == CHECKPOINT:
            return self.dispatch_checkpoint(p, r)
        if op == PLAYER:
            if room.barrier:
                return CLOSED, b''
            player = Player.read(r)
            r.done()
            if p.player or len(room.players) >= word(room.session.desc, 40):
                return FULL, b''
            if player.flags & 0x100 and p is not room.host:
                return ACCESS, b''
            player.id = 1 if player.flags & 0x100 else room.next_player
            if player.id in room.players:
                return ACCESS, b''
            if player.id != 1:
                room.next_player += 1
            p.player = player
            room.players[player.id] = player
            room.session.patch(44, len(room.players))
            event = put(len(room.players)) + player.encode()
            room.event(PLAYER_EVENT, event, exclude=p)
            logging.info('Player %d joined; roster %d', player.id, len(room.players))
            return 0, event
        if op == SEND:
            sequence, sender, to, flags = r.u32(), r.u32(), r.u32(), r.u32()
            packet = r.take(len(body) - r.at)
            if not p.player or sender != p.player.id or sequence != p.rx + 1 or flags & ~0x1b or len(packet) > 65536:
                raise ValueError('invalid sender, sequence, flags or packet length')
            if to and to not in room.players:
                raise ValueError('invalid recipient')
            p.rx = sequence
            for target in room.members:
                if target.player and ((not to and target is not p) or (to and target.player.id == to)):
                    target.tx += 1
                    target.enqueue(PACKET_EVENT, put(target.tx, sender, target.player.id) + packet)
            p.enqueue(SEND_ACK, put(sequence))
            return 0, b''
        if op == SESSION:
            if room.barrier:
                return CLOSED, b''
            session = Session.read(r)
            r.done()
            if p is not room.host or session.desc[8:40] != room.session.desc[8:40]:
                return ACCESS, b''
            if not len(room.members) <= word(session.desc, 40) <= 16:
                return INVALID, b''
            session.patch(44, len(room.players))
            room.session = session
            room.event(SESSION_EVENT, session.encode(True), exclude=p)
            return 0, session.encode(True)
        if op in (DATA, NAME, DESTROY):
            pid = r.u32()
            if not p.player or pid != p.player.id:
                return ACCESS, b''
            if op == DESTROY and room.barrier:
                r.done()
                if room.barrier.committed:
                    self.end_room(room)
                    return 0, b''
                self.barrier_event(room, BARRIER_CANCELED)
                self.clear_barrier(room)
            if op == DATA:
                p.player.data = r.string(65536)
                event = DATA_EVENT
            elif op == NAME:
                p.player.short, p.player.long = r.string(), r.string()
                event = NAME_EVENT
            else:
                del room.players[pid]
                room.session.patch(44, len(room.players))
                event = DESTROY_EVENT
            r.done()
            room.event(event, put(len(room.players)) + p.player.encode(), exclude=p)
            if op == DESTROY:
                p.player = None
            return 0, b''
        if op == LEAVE:
            r.done()
            self.depart(p)
            return 0, b''
        return INVALID, b''

    async def handle(self, socket):
        if socket.request.path != '/rooms' or len(self.peers) >= 128:
            await socket.close(1008, 'Invalid endpoint or capacity reached')
            return
        p = Peer(socket)
        self.peers.add(p)
        writer = asyncio.create_task(p.write())
        try:
            async for message in socket:
                if not isinstance(message, bytes) or not 20 <= len(message) <= LIMIT:
                    raise ValueError('invalid frame')
                magic, version, op, request, status = HEADER.unpack_from(message)
                if (magic, version, status) != (MAGIC, VERSION, 0) or op & REPLY:
                    raise ValueError('invalid protocol header')
                if op == SEND:
                    if request:
                        raise ValueError('send cannot be an RPC')
                elif not request or request <= p.request:
                    raise ValueError('invalid request sequence')
                else:
                    p.request = request
                hr, answer = self.dispatch(p, op, message[20:])
                if request:
                    p.enqueue(op | REPLY, answer, request, hr)
        except (ValueError, asyncio.TimeoutError) as error:
            logging.info('Rejected connection: %s', error)
            await socket.close(1008, 'Protocol or queue violation')
        except ConnectionClosed:
            pass
        finally:
            try:
                self.depart(p)
            except ValueError:
                logging.warning('Room closed with a full peer queue')
            self.peers.discard(p)
            writer.cancel()
            await asyncio.gather(writer, return_exceptions=True)


async def main(args):
    relay = Relay()
    async with serve(relay.handle, args.host, args.port, subprotocols=['recomp-directplay-v1'],
                     origins=args.origin or ['http://localhost:8000', 'http://localhost:8001'],
                     compression=None, max_size=LIMIT, max_queue=64, write_limit=65536,
                     open_timeout=10, close_timeout=3) as server:
        print(f'Room relay at ws://{args.host}:{args.port}/rooms', flush=True)
        await server.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8002)
    parser.add_argument('--origin', action='append')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
    asyncio.run(main(args))
