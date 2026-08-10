#!/usr/bin/env bash
# Copy generated MCP tools/handlers from a local 1msg-api checkout.
set -euo pipefail
API_ROOT="${ONE_MSG_API_ROOT:-${1:-../1msg-api}}"
SRC="$API_ROOT/packages/mcp/src"
DST="$(cd "$(dirname "$0")/.." && pwd)/src"
for f in tools.generated.ts handlers.generated.ts; do
  cp "$SRC/$f" "$DST/$f"
  echo "synced $f"
done
