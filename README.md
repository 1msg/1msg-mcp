# @1msg/mcp

MCP server for the [1MSG](https://1msg.io) WhatsApp Business API — **62 public tools** for Cursor, Claude Desktop, and other [MCP](https://modelcontextprotocol.io/) clients.

Transports: **stdio** (local) and **Streamable HTTP** (Cloud).

| | |
|--|--|
| **npm** | [`@1msg/mcp`](https://www.npmjs.com/package/@1msg/mcp) |
| **Cloud** | https://mcp.1msg.io/mcp |
| **SDK** | [`@1msg/sdk`](https://www.npmjs.com/package/@1msg/sdk) |

API hosts:

| Environment | `ONE_MSG_BASE_URL` |
|-------------|--------------------|
| Live channels | `https://api.1msg.io` |
| Test channels | `https://sandbox.1msg.io` |

> Source of truth for **codegen** of `tools.generated.ts` / `handlers.generated.ts` still lives in the `1msg-api` monorepo (`packages/mcp`). This repository is the **distribution** package for running and hosting the server.

## Quick start

### npx (stdio)

```bash
export ONE_MSG_BASE_URL=https://api.1msg.io
export ONE_MSG_INSTANCE_ID=your-instance-id
export ONE_MSG_TOKEN=your-channel-token

npx -y @1msg/mcp
# or, after clone + build:
# npm start
```

For **test channels**, set `ONE_MSG_BASE_URL=https://sandbox.1msg.io` (bare `sandbox.1msg.io` is also accepted).


### Clone and run

```bash
git clone https://github.com/1msg/1msg-mcp.git
cd 1msg-mcp
npm install
npm run build

export ONE_MSG_BASE_URL=https://api.1msg.io
export ONE_MSG_INSTANCE_ID=your-instance-id
export ONE_MSG_TOKEN=your-channel-token

npm start                 # stdio → dist/index.js
npm run start:http        # Streamable HTTP → dist/http.js
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ONE_MSG_BASE_URL` | yes (stdio) | API root: `https://api.1msg.io` (live) or `https://sandbox.1msg.io` (test) |
| `ONE_MSG_TOKEN` | yes (stdio) | Channel API token |
| `ONE_MSG_INSTANCE_ID` | yes (stdio) | Channel instance id |
| `MCP_HTTP_HOST` | no | HTTP bind host (default `0.0.0.0` in Docker) |
| `MCP_HTTP_PORT` | no | HTTP port (default `3100`) |
| `MCP_RATE_LIMIT_RPM` | no | Per-token rate limit for HTTP (default `60`) |

For **Cloud HTTP**, the server default upstream is `ONE_MSG_BASE_URL` (typically live). Clients send credentials per request; test channels can also send `X-1msg-Base-Url: https://sandbox.1msg.io`.

## Cursor (`mcp.json`)

### Local stdio

Live channel:

```json
{
  "mcpServers": {
    "1msg": {
      "command": "npx",
      "args": ["-y", "@1msg/mcp"],
      "env": {
        "ONE_MSG_BASE_URL": "https://api.1msg.io",
        "ONE_MSG_INSTANCE_ID": "your-instance-id",
        "ONE_MSG_TOKEN": "your-channel-token"
      }
    }
  }
}
```

Test channel: set `"ONE_MSG_BASE_URL": "https://sandbox.1msg.io"`.

### Cloud URL (Streamable HTTP)

Cloud endpoint: [https://mcp.1msg.io/mcp](https://mcp.1msg.io/mcp)

```json
{
  "mcpServers": {
    "1msg": {
      "url": "https://mcp.1msg.io/mcp",
      "headers": {
        "Authorization": "Bearer your-channel-token",
        "X-Instance-Id": "your-instance-id"
      }
    }
  }
}
```

For a **test channel**, add `"X-1msg-Base-Url": "https://sandbox.1msg.io"`.

Header aliases: `X-1msg-Instance-Id` (and deprecated `X-Chat-Api-Instance-Id`). Do not commit real tokens.

## Cloud HTTP locally

```bash
export ONE_MSG_BASE_URL=https://api.1msg.io
export MCP_HTTP_PORT=3100
npm run start:http
```

- Auth: `Authorization: Bearer <token>` + `X-Instance-Id: <instanceId>`
- Optional: `X-1msg-Base-Url: https://sandbox.1msg.io` for test channels
- Health: `GET /healthz`, `GET /readyz`

```bash
docker build -t 1msg/1msg-mcp-http:local .
docker run --rm -p 3100:3100 \
  -e ONE_MSG_BASE_URL=https://api.1msg.io \
  1msg/1msg-mcp-http:local
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm test` | Jest unit tests |
| `npm run smoke:tools-list` | Stdio `tools/list` smoke (expects 62 tools; uses dummy token) |
| `npm start` / `npm run start:http` | Run stdio / HTTP servers |

## Architecture

All API HTTP goes through `@1msg/sdk`. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
