# Native transport for safe multiplayer qualification

The subsequent [native SDK public TLS check](native-public-protocol.md) verifies
successful authenticated WSS with the default Foundation transport. Both SDK
roles deliver real stopped kingdom bytes through an owned temporary public
route, with767 reported checks and no failures. This does not establish original
world loading, a complete internet match or independent-machine participation.

Native183 links a Foundation WebSocket implementation in the existing
kit/platform/os_posix.cpp. This removes the Mac native socket stub, allowing
future game-to-relay verification without launching a browser. It does not
establish that the game's cooperative load/rebuild/resume flow works.

The implementation uses Apple's NSURLSessionWebSocketTask for TCP/TLS and
RFC6455 framing, with the standard platform certificate handling. Open requires
one negotiated subprotocol, a bounded ws/wss URL without userinfo/fragment,
and a supported Foundation version. Native Apple callbacks use a private
serial delegate queue; they own host bytes and signal the scheduler without
accessing guest memory. Browser callbacks retain their existing implementation;
Linux and Windows native transport remain unsupported. The Apple path is
verified only on this Mac, not iOS or older OS versions.

Each connection admits messages up to66560 bytes and inbound/outstanding-send
queues up to2 MiB and4096 entries. Foundation's maximumMessageSize also bounds
fragmented receive buffering. Sixteen live handles are allowed. Connection
tokens increase monotonically and never recycle. Close retires the token,
clears notifications/queues, cancels the task and invalidates its session;
late delegate and send/receive callbacks cannot find a replacement connection.
Notifications must not reenter the socket API. Caller handle operations remain
serialized by the existing guest baton; Close consumes the caller's handle.

Sessions use ephemeral configuration without cookie, credential or response
cache stores. Redirects do not silently move a room connection. This change
sets no trust overrides and installs no certificates. The transport bounds
its own queues, not total Foundation/kernel/browser memory or gameplay latency.

## DirectPlay connection qualification

The follow-on real socket fixture now verifies the DirectPlay guest COM ABI
and native checkpoint seams for both hosting and joining:329 reported checks
pass across four actual connections, including synthetic chunk transfer,
agreement completion, partial-transfer cancellation with room continuity,
ordinary packets and disconnect. See [native-directplay-network.md](native-directplay-network.md).
It launches no original game world and supplies no game save/load/resume proof.

## Verification

From the parent workspace run with the game's Python environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/test-native-websocket.py --attempt <fresh-number>
```

The driver starts owned loopback WS and self-signed WSS fixtures on ephemeral
ports, then invokes the official one-job tools/test.py wrapper for
platform_websocket_tests. NATIVE_WEBSOCKET_TEST_URL and
NATIVE_WEBSOCKET_TEST_TLS_URL identify those fixtures; missing settings fail
instead of silently skipping. The network CTest label keeps the fixture-dependent
suite out of the ordinary portable test run. The driver closes the fixtures,
removes their temporary TLS key/certificate and freezes sources, binary and log.

Final run native-websocket-003 passes153 checks across35 actual plain-WS
connections. Binary content, retained small-buffer reads, maximum/fragmented
messages, malformed/empty/text input, queue byte/count saturation, outgoing
pressure, missing negotiated protocol, remote Close and twelve Close/reopen
callback cases are covered. The local untrusted WSS connection is refused;
successful authenticated WSS and public internet participation are not tested.
The initial001 run failed before opening any socket because the official
wrapper stripped the original fixture environment prefix.002 corrects that
setup;003 includes the Foundation availability guard and is the current result.

The portable platform regression passes212 checks. Native183's official game
build succeeds;44 compiled source/config inputs, the binary and build evidence
are frozen in output/native-coop-checkpoint-generation-183-preserved.json.
Socket sources/tests and results are in output/native-websocket-003/ and its
observed report. All test/build producers are terminal and absent. Served
browser files and existing services remain unchanged.

No native game session or DirectPlay room is opened in the platform-only tests above; the follow-on SDK test opens real rooms as described separately. Original
game Request/EndAck/import/Ready, actual shared attachment/rebuild/Loaded/resume,
fresh co-op region generation, full-match completion, independent internet
qualification and sustained browser bounds remain unfinished. The next step
is original-world cooperative loading through the qualified native connection. Browser launch suspension remains in force
while the host-app crash is unresolved.

API reference: [Apple Foundation WebSocket documentation](https://developer.apple.com/documentation/foundation/urlsessionwebsockettask).
