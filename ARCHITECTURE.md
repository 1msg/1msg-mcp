# MCP package architecture

The `@1msg/mcp` package **must not** call the 1MSG API directly.
All HTTP goes through [`@1msg/sdk`](https://www.npmjs.com/package/@1msg/sdk).

```text
OpenAPI YAML (1msg-api monorepo)
  └─► codegen
        ├─► NestJS controllers
        ├─► @1msg/sdk            ← HTTP + types (published npm)
        └─► @1msg/mcp            ← MCP protocol + tools only (this repo)
```

Generated files (`src/tools.generated.ts`, `src/handlers.generated.ts`) are produced in `1msg-api` and synced into this distribution repo when tools change.

| Transport | Entry | Config |
|-----------|-------|--------|
| stdio | `dist/index.js` | Process env `ONE_MSG_*` (deprecated: `CHAT_API_*`). API root: `https://api.1msg.io` or `https://sandbox.1msg.io` |
| HTTP (Cloud) | `dist/http.js` | Per request: `Authorization: Bearer` + `X-Instance-Id`; optional `X-1msg-Base-Url` (`https://api.1msg.io` or `https://sandbox.1msg.io`). Default upstream from host `ONE_MSG_BASE_URL` |
