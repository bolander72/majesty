#!/bin/bash
# Expose only the running room relay through a temporary public TLS endpoint.
set -euo pipefail
MAJESTY_RELAY_PORT="${1:-8002}"
if [[ ! "$MAJESTY_RELAY_PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( MAJESTY_RELAY_PORT > 65535 )); then
  echo "Usage: $0 [relay-port: 1..65535]" >&2
  exit 2
fi
if ! command -v cloudflared >/dev/null; then
  echo "cloudflared is required to create a temporary public relay." >&2
  exit 1
fi
MAJESTY_TUNNEL_TMP="$(mktemp -d "${TMPDIR:-/tmp}/majesty-relay-tunnel.XXXXXX")"
trap 'rm -rf -- "$MAJESTY_TUNNEL_TMP"' EXIT
# An existing cloudflared config can supply ingress rules that return 404
# even after a Quick Tunnel URL is created. Never edit the user's config.
printf '{}\n' > "$MAJESTY_TUNNEL_TMP/config.yml"
cloudflared tunnel --config "$MAJESTY_TUNNEL_TMP/config.yml" \
  --url "http://127.0.0.1:$MAJESTY_RELAY_PORT" --no-autoupdate
