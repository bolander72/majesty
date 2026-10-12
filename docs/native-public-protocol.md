# Native room and checkpoint protocol through public TLS

Attempt012 passes the native DirectPlay SDK test over a temporary public
Cloudflare WSS route. Both the native SDK and its Python reference peer use the
public hostname, authenticated TLS and `recomp-directplay-v1`. Hosting and
joining run sequentially, with one SDK producer at a time. The relay and both
clients run on this Mac; the encrypted connections traverse the public TLS
endpoint. This is not play between independent machines or original worlds.

The unchanged production room relay accepts HELLO, authenticates its registered
players and forwards their original wire payloads. Each role delivers the pinned
317,365-byte stopped kingdom in 20 chunks, at most one 16 KiB chunk awaiting
acknowledgement. Every received chunk matches the private input and both stream
digests match its independently pinned SHA-256. Both roles complete the fixture
Ready/Loaded agreement, coordinate Complete consumption, cancel a later partial
transfer and keep the room usable for ordinary packets before disconnecting.
Their votes do not attest game-owned import, original loading or shared resume.

The native host reports405 checks and the guest362, with no failures. Reported
counts include timing-dependent polling checks. Five accepted connections are
one TLS/subprotocol/real HELLO readiness probe plus four role/reference sockets.
The probe creates no room and sends no original game packets. SDK groups and
the owned tunnel are terminal and absent; the relay has no remaining peers or
rooms. Served files retain their digests, sizes, inodes and modification times.
No original game or browser launches. The subsequent loopback regression013
reports679 passing checks with the same stopped bytes and routing wrapper.

## Bounded owned route

The helper uses an existing installed cloudflared binary, an empty private
configuration and an anonymous temporary tunnel. It neither inherits account
tokens nor changes existing tunnels or configuration. Only a fresh 256-bit
secret HTTP path is accepted. The wrapper then maps that authorized path to
the relay's original `/rooms` endpoint; no WebSocket payload is rewritten.
The token is not printed, put in tunnel argv or published. Wrong paths receive
404 before relay access; direct unauthorized handler calls are also refused.

The tunnel has sampled128 MiB RSS/1 MiB log ceilings, a45-second startup limit
and300-second total deadline. The SDK supervisor retains its768 MiB one-job
build and512 MiB SDK limits,180-second deadline and4 MiB logs per role. Cleanup
signals only owned groups, escalates when needed and checks actual absence.
These are sampled stop thresholds rather than OS allocation limits. Attempt012
peaks at72.42 MiB/77.16 MiB per SDK build/test group and41.42 MiB for the tunnel;
these are not original-game, whole-browser or combined simultaneous peaks.

Fresh tunnel hostnames initially returned NXDOMAIN from the default resolver.
An independent public resolver returned addresses for the same live hostname.
The helper reads the default SOA negative-cache TTL once and permits a bounded
readiness wait of at most180 seconds. Attempt012 observes TTL60 and waits within
a120-second window; its39th probe succeeds. DNS settings, DNS caches and
certificate trust are not changed or bypassed.

Six focused tests cover strict origin parsing, invalid ports, startup timeout,
cleanup after a caller failure, preservation of an unrelated child and real
local path/HELLO routing. They use tiny local children and a local relay, not
a real tunnel or original game. The initial route test's incorrect HELLO-body
expectation is preserved; the actual production reply has an empty body.

## Retained failures and reproduction

Attempts008..010 stop during DNS/TLS preflight, before any SDK producer starts.
Attempt011 passes the TLS/subprotocol handshake but the original relay refuses
the temporary secret path. The final wrapper normalizes only an authorized
path, and readiness additionally requires a successful real HELLO reply. All
owned failed tunnels are terminal and absent; their evidence is retained.

Run from the parent workspace using a fresh attempt:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/test-native-directplay-network.py \
  --attempt <fresh-number> --public-tunnel --owned-kingdom-snapshot
```

Evidence: `output/native-directplay-network-012/run.json`, its two official logs
and guard reports, `public-tunnel.json`, `output/native-public-route-002/`, and
`output/native-public-protocol-001-preserved/preserved.json`. The owned temporary
route is closed; its recorded hostname is not a running game endpoint.

Two live original kingdoms, game-owned checkpoint import/read/Loaded/resume,
full shared victory/defeat and competitive completion, independent internet
participants and sustained browser rendering/simulation bounds remain
unqualified. The prepared native pair still needs the existing human exception;
browser game launches remain suspended. The full goal remains active.
