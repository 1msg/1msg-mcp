#!/usr/bin/env bash
# Probe the actual HTTP image with dummy credentials and no external network.
set -euo pipefail
name="mcp-smoke-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs "$name" 2>&1 || true; fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT
docker build -t "$name" .
docker run -d --name "$name" --network none \
  -e ONE_MSG_BASE_URL=http://127.0.0.1:9 "$name" >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$name" node -e 'fetch("http://127.0.0.1:3100/healthz").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done
docker exec -i "$name" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3100';
assert.notEqual(process.getuid(), 0, 'Shipping image must run as a non-root user');
for (const path of ['/healthz', '/readyz']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
}
const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'isolated-image-smoke', version: '1.0.0' }
}};
const rejected = await fetch(base + '/mcp', { method: 'POST', headers, body: JSON.stringify(initialize) });
assert.equal(rejected.status, 401);
headers.authorization = 'Bearer dummy-isolated-smoke-token';
headers['x-instance-id'] = 'ODI371267300';
const initialized = await fetch(base + '/mcp', { method: 'POST', headers, body: JSON.stringify(initialize) });
assert.equal(initialized.status, 200);
assert.ok(initialized.headers.get('mcp-session-id'));
await initialized.text();
headers['mcp-session-id'] = '00000000-0000-4000-8000-000000000000';
const response = await fetch(base + '/mcp', { method: 'POST', headers,
  body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) });
assert.equal(response.status, 200);
const body = await response.text();
const payload = body.startsWith('{') ? JSON.parse(body) : JSON.parse(body.split('\n').find(line => line.startsWith('data:')).slice(5));
assert.ok(payload.result.tools.length > 0);
console.log('Shipping image: non-root startup, health, readiness, auth rejection, initialize and stale-session tools/list passed');
NODE
