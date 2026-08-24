#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { McpServer as McpServerType } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StreamableHTTPServerTransport as StreamableHTTPServerTransportType } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ChatApiClient } from '@1msg/sdk';
import { McpAuthError, resolveRequestConfig } from './auth';
import { normalizeBaseUrl, toChatApiConfig } from './config';
import { hashIdentifier, logRequest } from './logging';
import { RateLimiter, rateLimitKeyFromToken } from './rate-limit';
import { createMcpServer } from './server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js') as {
  StreamableHTTPServerTransport: typeof StreamableHTTPServerTransportType;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js') as {
  isInitializeRequest: (value: unknown) => boolean;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createMcpExpressApp } = require('@modelcontextprotocol/sdk/server/express.js') as {
  createMcpExpressApp: (options?: {
    host?: string;
    allowedHosts?: string[];
  }) => import('express').Express;
};

const PACKAGE_NAME = '@1msg/mcp';
const VERSION = '1.2.2';

interface SessionEntry {
  transport: StreamableHTTPServerTransportType;
  server: McpServerType;
  instanceIdHash: string;
  tokenHash: string;
}

export interface HttpServerOptions {
  baseUrl: string;
  port: number;
  host: string;
  rateLimitRpm: number;
  allowedHosts?: string[];
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function loadHttpOptionsFromEnv(): HttpServerOptions {
  const baseUrl =
    process.env.ONE_MSG_BASE_URL?.trim() ||
    process.env.CHAT_API_BASE_URL?.trim() ||
    process.env.CHAT_API_ROOT_URL?.trim() ||
    process.env.CHAT_API_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      'ONE_MSG_BASE_URL is required for HTTP mode (fixed upstream API root).',
    );
  }

  const allowedHosts = process.env.MCP_ALLOWED_HOSTS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    port: readEnvInt('MCP_HTTP_PORT', 3100),
    host: process.env.MCP_HTTP_HOST?.trim() || '0.0.0.0',
    rateLimitRpm: readEnvInt('MCP_RATE_LIMIT_RPM', 60),
    allowedHosts: allowedHosts?.length ? allowedHosts : undefined,
  };
}

function sendJson(res: Response, status: number, body: unknown): void {
  if (res.headersSent) {
    return;
  }
  res.status(status).json(body);
}

function mcpError(code: number, message: string): unknown {
  return {
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  };
}

/** Create Express app hosting Streamable HTTP MCP at /mcp. */
export function createHttpApp(options: HttpServerOptions): import('express').Express {
  const sessions = new Map<string, SessionEntry>();
  const limiter = new RateLimiter({
    limit: options.rateLimitRpm,
    windowMs: 60_000,
  });

  const app = createMcpExpressApp({
    host: options.host,
    allowedHosts: options.allowedHosts,
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: PACKAGE_NAME,
      version: VERSION,
      transport: 'streamable-http',
    });
  });

  app.get('/readyz', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const handleMcp = async (req: Request, res: Response): Promise<void> => {
    const requestId = randomUUID();
    const started = Date.now();
    const sessionHeader = req.header('mcp-session-id')?.trim();

    try {
      let credentials;
      try {
        credentials = resolveRequestConfig(
          { baseUrl: options.baseUrl },
          req.headers,
        );
      } catch (error) {
        if (error instanceof McpAuthError) {
          logRequest({
            requestId,
            method: req.method,
            path: req.path,
            status: error.statusCode,
            error: error.message,
            latencyMs: Date.now() - started,
          });
          sendJson(res, error.statusCode, mcpError(-32001, error.message));
          return;
        }
        throw error;
      }

      const tokenKey = rateLimitKeyFromToken(credentials.token);
      const limitResult = limiter.check(tokenKey);
      res.setHeader('X-RateLimit-Limit', String(limitResult.limit));
      res.setHeader('X-RateLimit-Remaining', String(limitResult.remaining));
      if (!limitResult.allowed) {
        res.setHeader('Retry-After', String(limitResult.retryAfterSec));
        logRequest({
          requestId,
          method: req.method,
          path: req.path,
          status: 429,
          instanceIdHash: hashIdentifier(credentials.instanceId),
          error: 'rate_limited',
          latencyMs: Date.now() - started,
        });
        sendJson(
          res,
          429,
          mcpError(-32029, `Rate limit exceeded. Retry after ${limitResult.retryAfterSec}s.`),
        );
        return;
      }

      let entry: SessionEntry | undefined =
        sessionHeader ? sessions.get(sessionHeader) : undefined;

      if (entry) {
        if (entry.tokenHash !== tokenKey) {
          sendJson(
            res,
            403,
            mcpError(-32003, 'Session credentials do not match Authorization header.'),
          );
          return;
        }
      } else if (req.method === 'POST' && isInitializeRequest(req.body)) {
        const client = new ChatApiClient(toChatApiConfig(credentials));
        const server = createMcpServer(client);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            sessions.set(sessionId, {
              transport,
              server,
              instanceIdHash: hashIdentifier(credentials.instanceId),
              tokenHash: tokenKey,
            });
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
          }
        };

        await server.connect(transport);
        entry = {
          transport,
          server,
          instanceIdHash: hashIdentifier(credentials.instanceId),
          tokenHash: tokenKey,
        };
        // session registered in onsessioninitialized after handleRequest
        await transport.handleRequest(req, res, req.body);
        logRequest({
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          instanceIdHash: entry.instanceIdHash,
          latencyMs: Date.now() - started,
          event: 'mcp_initialize',
        });
        return;
      } else if (!sessionHeader) {
        sendJson(
          res,
          400,
          mcpError(
            -32000,
            'Missing mcp-session-id. Send an initialize request first.',
          ),
        );
        return;
      } else {
        sendJson(res, 404, mcpError(-32001, 'Unknown or expired MCP session.'));
        return;
      }

      await entry.transport.handleRequest(req, res, req.body);
      logRequest({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        instanceIdHash: entry.instanceIdHash,
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logRequest({
        requestId,
        method: req.method,
        path: req.path,
        status: 500,
        error: message,
        latencyMs: Date.now() - started,
      });
      sendJson(res, 500, mcpError(-32603, 'Internal server error'));
    }
  };

  app.post('/mcp', (req, res) => {
    void handleMcp(req, res);
  });
  app.get('/mcp', (req, res) => {
    void handleMcp(req, res);
  });
  app.delete('/mcp', (req, res) => {
    void handleMcp(req, res);
  });

  return app;
}

/** Start Cloud MCP HTTP server (blocks until listen). */
export async function startHttpServer(
  options: HttpServerOptions = loadHttpOptionsFromEnv(),
): Promise<import('http').Server> {
  const app = createHttpApp(options);
  return await new Promise((resolve, reject) => {
    const server = app.listen(options.port, options.host, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      logRequest({
        requestId: createHash('sha256').update(String(options.port)).digest('hex').slice(0, 8),
        event: 'http_listen',
        path: '/mcp',
        status: 200,
        port: options.port,
        host: options.host,
        baseUrlHost: (() => {
          try {
            return new URL(options.baseUrl).host;
          } catch {
            return 'invalid';
          }
        })(),
      });
      resolve(server);
    });
  });
}

function printUsage(): void {
  const lines = [
    `${PACKAGE_NAME} HTTP host v${VERSION}`,
    '',
    'Streamable HTTP MCP server for the 1MSG API (Cloud).',
    '',
    'Usage:',
    '  node dist/http.js [--help]',
    '',
    'Environment:',
    '  ONE_MSG_BASE_URL     Default upstream API root (required)',
    '                        Live: https://api.1msg.io  Test: https://sandbox.1msg.io',
    '  MCP_HTTP_PORT         Listen port (default 3100)',
    '  MCP_HTTP_HOST         Bind address (default 0.0.0.0)',
    '  MCP_RATE_LIMIT_RPM    Per-token requests/minute (default 60)',
    '  MCP_ALLOWED_HOSTS     Comma-separated Host allowlist (optional)',
    '',
    'Client headers (per request):',
    '  Authorization: Bearer <channel-token>',
    '  X-Instance-Id: <instance-id>',
    '  X-1msg-Base-Url: https://api.1msg.io | https://sandbox.1msg.io (optional)',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return 0;
  }

  await startHttpServer();
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
