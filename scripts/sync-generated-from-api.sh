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

# Public npm @1msg/sdk still exports ChatApiClient (workspace SDK uses Client).
python3 - "$DST/handlers.generated.ts" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
old = "import type { Client } from '@1msg/sdk';"
new = "import type { ChatApiClient as Client } from '@1msg/sdk';"
if old not in text:
    raise SystemExit(f'rewrite failed: {old!r} not found in {path}')
path.write_text(text.replace(old, new, 1))
print('rewrote Client -> ChatApiClient as Client')
PY
