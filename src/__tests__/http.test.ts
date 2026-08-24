import http from 'node:http';
import { createHttpApp } from '../http';

describe('createHttpApp', () => {
  it('serves healthz without auth', async () => {
    const app = createHttpApp({
      baseUrl: 'https://api.example.test',
      port: 0,
      host: '127.0.0.1',
      rateLimitRpm: 60,
    });

    const server = await new Promise<http.Server>((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', (err?: Error) => {
        if (err) reject(err);
        else resolve(s);
      });
    });

    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('expected TCP address');
      }
      const res = await fetch(`http://127.0.0.1:${addr.port}/healthz`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; transport: string };
      expect(body.ok).toBe(true);
      expect(body.transport).toBe('streamable-http');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('rejects MCP without credentials', async () => {
    const app = createHttpApp({
      baseUrl: 'https://api.example.test',
      port: 0,
      host: '127.0.0.1',
      rateLimitRpm: 60,
    });

    const server = await new Promise<http.Server>((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', (err?: Error) => {
        if (err) reject(err);
        else resolve(s);
      });
    });

    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('expected TCP address');
      }
      const res = await fetch(`http://127.0.0.1:${addr.port}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.0.0' },
          },
        }),
      });
      expect(res.status).toBe(401);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('fails over tools/list when mcp-session-id is unknown (cross-LB DNS RR)', async () => {
    const app = createHttpApp({
      baseUrl: 'https://api.example.test',
      port: 0,
      host: '127.0.0.1',
      rateLimitRpm: 60,
    });

    const server = await new Promise<http.Server>((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', (err?: Error) => {
        if (err) reject(err);
        else resolve(s);
      });
    });

    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('expected TCP address');
      }
      const res = await fetch(`http://127.0.0.1:${addr.port}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer dummy-token',
          'x-instance-id': 'ODI371267300',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-session-id': '00000000-0000-4000-8000-000000000000',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      });
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(200);
      const raw = await res.text();
      const jsonLine = raw.includes('data:')
        ? raw
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n')
        : raw;
      const body = JSON.parse(jsonLine) as {
        result?: { tools?: { name: string }[] };
      };
      expect(Array.isArray(body.result?.tools)).toBe(true);
      expect((body.result?.tools?.length ?? 0) > 0).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
