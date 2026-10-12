"""Passive proposal observer: enable lanes, preserve events, never vote/load."""
import hashlib


class ProposalObservedSocket:
    """Forward an unchanged socket while preserving authenticated SDK RPC bytes."""
    def __init__(self, socket, relay, service, packets, report, save):
        self.socket, self.relay, self.service = socket, relay, service
        self.packets, self.report, self.save = packets, report, save
        self.iterator = socket.__aiter__()

    def __getattr__(self, name):
        return getattr(self.socket, name)

    def __aiter__(self):
        return self

    async def __anext__(self):
        message = await self.iterator.__anext__()
        relay = self.relay
        if isinstance(message, bytes) and len(message) >= 20:
            magic, version, op, request, status = relay.HEADER.unpack_from(message)
            if op in (relay.BARRIER, relay.CHECKPOINT):
                saved_return = self.report.get('replaySavedReturnHostRequested') is True
                maximum = relay.CHECKPOINT_CHUNK_BYTES + 40 if saved_return and op == relay.CHECKPOINT else 2048
                if (magic, version, status) != (relay.MAGIC, 1, 0) or not request or not 24 <= len(message) <= maximum:
                    raise ValueError('Invalid/unbounded observed proposal RPC')
                peer = next((p for p in self.service.peers if p.socket is self), None)
                if not peer or not peer.player or not peer.room:
                    raise ValueError('Observed proposal RPC has no authenticated player')
                action = relay.word(message, 20)
                admitted_serials = (2, 3) if self.report.get('replaySavedRevisitHostRequested') is True else (2,)
                transfer = saved_return and op == relay.CHECKPOINT and action in range(6) and len(message) >= 28 and relay.word(message, 24) in admitted_serials
                if ((op == relay.BARRIER and action not in range(5)) or
                        (op == relay.CHECKPOINT and action != relay.CHECKPOINT_ENABLE and not transfer)):
                    raise ValueError('Fresh proposal observer does not admit checkpoint transfer')
                rows = self.report.setdefault('proposalProtocolRequests', [])
                third_completion = saved_return and self.report.get('replaySavedRevisitHostRequested') is True and self.report.get('replaySavedRevisitCompletionRequested') is True
                maximum_rows = 129 if third_completion else 128 if saved_return else 64
                if len(rows) >= maximum_rows or sum(row['bytes'] for row in rows) + len(message) > (1024 * 1024 if saved_return else 128 * 1024):
                    raise ValueError('Observed proposal RPC custody bound exceeded')
                path = self.packets / f'proposal-rpc-{len(rows):03}.bin'
                with path.open('xb') as stream:
                    stream.write(message)
                rows.append(dict(copy=str(path), bytes=len(message), sha256=hashlib.sha256(message).hexdigest(),
                                 sender=peer.player.id, host=peer is peer.room.host,
                                 op=op, action=action, request=request))
                self.save()
        return message


async def enable_proposal_observer(relay, rpc, report):
    if report.get('nativeBeginFreshNeighborRequested') is not True:
        raise ValueError('Require the explicit original-host fresh proposal fixture')
    reply = await rpc(relay.BARRIER, relay.put(relay.BARRIER_ENABLE) +
                      relay.string(relay.BARRIER_CONTRACT))
    if reply != relay.put(1):
        raise ValueError('Observer barrier enable refused')
    reply = await rpc(relay.CHECKPOINT, relay.put(relay.CHECKPOINT_ENABLE, 0) +
                      relay.string(relay.CHECKPOINT_CONTRACT))
    if reply != relay.put(1):
        raise ValueError('Observer checkpoint enable refused')
    report.update(referenceProposalObserverEnabled=True,
                  referenceProposalReadyVotesSent=0,
                  referenceProposalLoadedVotesSent=0,
                  observedProposalEvents=[])


def preserve_proposal_event(relay, body, packets, report):
    if report.get('referenceProposalObserverEnabled') is not True or len(body) > 2048:
        raise ValueError('Unbounded or unenabled proposal observation')
    rows = report['observedProposalEvents']
    if len(rows) >= 4:
        raise ValueError('Proposal event bound exceeded')
    reader = relay.Reader(body)
    serial, stage = reader.u32(), reader.u32()
    descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES)
    count = reader.u32()
    if count != 2:
        raise ValueError('Proposal observer requires both original players')
    players = [reader.u32() for _ in range(count)]
    reader.done()
    if (serial != 1 or players != [1, 2] or not descriptor or
            stage not in (relay.BARRIER_PREPARED, relay.BARRIER_CANCELED) or
            (not rows and stage != relay.BARRIER_PREPARED) or
            (rows and (len(rows) != 1 or stage != relay.BARRIER_CANCELED))):
        raise ValueError('Observer cannot accept a committed/loaded proposal without peer votes')
    path = packets / f'proposal-{len(rows):03}.bin'
    with path.open('xb') as stream:
        stream.write(body)
    rows.append(dict(copy=str(path), bytes=len(body),
                     sha256=hashlib.sha256(body).hexdigest(), serial=serial,
                     stage=stage, players=players,
                     descriptorSha256=hashlib.sha256(descriptor).hexdigest()))
