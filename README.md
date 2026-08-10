# @1msg/mcp

MCP server for the [1msg](https://1msg.io) Chat API — **60 public tools** for Cursor, Claude Desktop, and other [MCP](https://modelcontextprotocol.io/) clients.

Transports: **stdio** (local) and **Streamable HTTP** (hosted).

| | |
|--|--|
| **npm** | [`@1msg/mcp`](https://www.npmjs.com/package/@1msg/mcp) |
| **Hosted prod** | https://mcp.1msg.io/mcp |
| **Hosted stage** | https://mcp.stage.1msg.io/mcp |
| **SDK** | [`@1msg/sdk`](https://www.npmjs.com/package/@1msg/sdk) |

> Source of truth for **codegen** of `tools.generated.ts` / `handlers.generated.ts` still lives in the `1msg-api` monorepo (`packages/mcp`). This repository is the **distribution** package for running and hosting the server.

## Quick start

### npx (stdio)

```bash
export ONE_MSG_BASE_URL=https://api.stage.1msg.io
export ONE_MSG_INSTANCE_ID=your-instance-id
export ONE_MSG_TOKEN=your-channel-token

npx -y @1msg/mcp
# or, after clone + build:
# npm start
```

Deprecated aliases still work: `CHAT_API_BASE_URL`, `CHAT_API_TOKEN`, `CHAT_API_INSTANCE_ID`.

### Clone and run

```bash
git clone https://github.com/1msg/1msg-mcp.git
cd 1msg-mcp
npm install
npm run build

export ONE_MSG_BASE_URL=https://api.stage.1msg.io
export ONE_MSG_INSTANCE_ID=your-instance-id
export ONE_MSG_TOKEN=your-channel-token

npm start                 # stdio → dist/index.js
npm run start:http        # Streamable HTTP → dist/http.js
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ONE_MSG_BASE_URL` | yes (stdio) | API base, e.g. `https://api.stage.1msg.io` or `https://api.1msg.io` |
| `ONE_MSG_TOKEN` | yes (stdio) | Channel API token |
| `ONE_MSG_INSTANCE_ID` | yes (stdio) | Channel instance id |
| `MCP_HTTP_HOST` | no | HTTP bind host (default `0.0.0.0` in Docker) |
| `MCP_HTTP_PORT` | no | HTTP port (default `3100`) |
| `MCP_RATE_LIMIT_RPM` | no | Per-token rate limit for HTTP (default `60`) |

For **hosted HTTP**, upstream `ONE_MSG_BASE_URL` is set on the server; clients send credentials per request (see below).

## Cursor (`mcp.json`)

### Local stdio

```json
{
  "mcpServers": {
    "1msg": {
      "command": "npx",
      "args": ["-y", "@1msg/mcp"],
      "env": {
        "ONE_MSG_BASE_URL": "https://api.stage.1msg.io",
        "ONE_MSG_INSTANCE_ID": "your-instance-id",
        "ONE_MSG_TOKEN": "your-channel-token"
      }
    }
  }
}
```

### Hosted URL (Streamable HTTP)

Prod: [https://mcp.1msg.io/mcp](https://mcp.1msg.io/mcp) · Stage: [https://mcp.stage.1msg.io/mcp](https://mcp.stage.1msg.io/mcp)

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

Header aliases: `X-1msg-Instance-Id` (and deprecated `X-Chat-Api-Instance-Id`). Do not commit real tokens.

## Hosted HTTP locally

```bash
export ONE_MSG_BASE_URL=https://api.stage.1msg.io
export MCP_HTTP_PORT=3100
npm run start:http
```

- Auth: `Authorization: Bearer <token>` + `X-Instance-Id: <instanceId>`
- Health: `GET /healthz`, `GET /readyz`

```bash
docker build -t 1msg/1msg-mcp-http:local .
docker run --rm -p 3100:3100 \
  -e ONE_MSG_BASE_URL=https://api.stage.1msg.io \
  1msg/1msg-mcp-http:local
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm test` | Jest unit tests |
| `npm run smoke:tools-list` | Stdio `tools/list` smoke (expects 60 tools; uses dummy token) |
| `npm start` / `npm run start:http` | Run stdio / HTTP servers |

## Architecture

All Chat API HTTP goes through `@1msg/sdk`. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
