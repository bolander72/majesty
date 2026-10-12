# Internet co-op and competitive hosting

The game uses ordinary browser WebSockets and the original Majesty multiplayer
packets. Players import their own game files and keep their accounts, profiles
and saves locally. Steam, GOG Galaxy and a game-account login are not required.

The self-hosted package puts the static release and `/rooms` relay behind one
HTTPS domain. Invitations use `wss://YOUR-DOMAIN/rooms`; local development still
uses port 8002. Origin checks allow only the selected HTTPS game site.

## Prepare and run a server

Generate an exclusive bundle from a staged release report:

```sh
python3 scripts/prepare-multiplayer-hosting.py output/campaign075-site.json output/majesty-hosting
```

Copy that generated directory to your server. Install Docker with Compose, point
your domain’s DNS at that server, and make ports 80 and 443 reachable. Inside the
bundle directory, copy `.env.example` to `.env`, replace `game.example` with your
domain, then run:

```sh
docker compose --env-file .env up --build -d
docker compose logs --tail=30
```

Caddy serves the static release and forwards WebSockets to the relay. Its
[automatic HTTPS](https://caddyserver.com/docs/automatic-https) obtains and renews
the certificate; its [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
supports WebSocket upgrades. The relay uses the existing pinned websockets 15.0.1
protocol implementation. Its port is internal to the Compose network.

The bundle generator verifies every packaged file and excludes imported game
executables, installation ZIPs, native saves and writable profiles. It starts no
services. The output manifest records exact static/relay/template hashes.

## Play and recover

Each player opens the HTTPS site and imports their own game copy. The host opens
Multiplayer setup, chooses the mode/chapter/world, and copies the invitation.
Both choose Multiplayer → Play Over LAN (TCP/IP) in the original menu. The guest
joins and chooses Ready; the host chooses Start Game.

For an expanding world, use Save and pause before ending a session. If the
connection ends, the host chooses Recover saved world, prepares the latest
committed save, and sends its new resume invitation. The guest chooses Request
resume invitation and waits for that new link, using the same local profile.
Both kingdoms remain stopped until both players rejoin. Unsaved moves after the
checkpoint are not recovered. Co-op single-map and competitive sessions retain
the original lobby save/load flow.

The relay keeps live rooms in memory. Restarting it ends matches but does not
delete browser checkpoints or profiles. Use one relay instance for a shared room
directory; multiple replicas require room routing before they can share matches.

After shared victory, use **Next chapter** and choose a new world name before
sending the next invitation. Each chapter starts fresh kingdoms while earlier
regions and each player's completion remain saved. See
[campaign continuation](co-op-campaign-continuation.md).

## Verification scope

Frontend074 retains the qualified release073 engine. Two actual browser clients
on this Mac restored revision 3 at clock 18000 through a public TLS WebSocket
relay, played and saved revision 4 at clock 24550, then closed and reopened both
engines from a fresh recovery invitation. Both original saved-game readers
admitted revision 4 and continued to revision 5 at clock 31900. Real peer exits
verified the host's latest-checkpoint recovery and the guest's reconnect page.
All owned trial engines, relay and tunnel were released.

The generated Compose topology was also run in isolation with a trusted local
TLS certificate: static isolation headers, WASM range/MIME, two-client room
join, 100 ordered binary messages, disconnect and wrong-origin/subprotocol
refusal passed through Caddy. The owned test stack was removed. There is no
permanent public deployment yet.

These results do not prove independent-household gameplay, adverse WAN
conditions, competitive match completion or long-session browser resource
bounds. A permanent domain/server and a player on another network are the next
qualification step. Evidence: `output/internet074-qualified.json` and
`output/internet074-hosting-tls-qualified.json`.
