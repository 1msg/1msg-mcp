import type { IncomingMessage } from 'node:http';
import {
  isClientSelectableApiHost,
  normalizeBaseUrl,
  type McpServerConfig,
} from './config';

export class McpAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'McpAuthError';
    this.statusCode = statusCode;
  }
}

function headerValue(
  headers: IncomingMessage['headers'],
  name: string,
): string | undefined {
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0]?.trim() || undefined;
  }
  return typeof raw === 'string' ? raw.trim() || undefined : undefined;
}

/** Extract Bearer token from Authorization (or plain token header). */
export function extractBearerToken(headers: IncomingMessage['headers']): string {
  const authorization = headerValue(headers, 'authorization');
  if (authorization) {
    const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
    if (bearer?.[1]) {
      return bearer[1].trim();
    }
    // Allow raw token in Authorization (Chat API TokenGuard parity).
    if (!authorization.includes(' ')) {
      return authorization;
    }
    throw new McpAuthError(
      'Invalid Authorization header. Use: Authorization: Bearer <channel-token>',
    );
  }

  const apiKey = headerValue(headers, 'x-api-key');
  if (apiKey) {
    return apiKey;
  }

  throw new McpAuthError(
    'Missing credentials. Send Authorization: Bearer <channel-token> (or X-API-Key).',
  );
}

/** Extract channel instance id from dedicated headers. */
export function extractInstanceId(headers: IncomingMessage['headers']): string {
  const instanceId =
    headerValue(headers, 'x-instance-id') ||
    headerValue(headers, 'x-1msg-instance-id') ||
    headerValue(headers, 'x-chat-api-instance-id');
  if (!instanceId) {
    throw new McpAuthError(
      'Missing X-Instance-Id header (channel instance id). Aliases: X-1msg-Instance-Id, X-Chat-Api-Instance-Id.',
    );
  }
  return instanceId;
}

export interface HttpHostConfig {
  /** Default upstream API root (Cloud host env). */
  baseUrl: string;
}

function extractBaseUrlOverride(
  headers: IncomingMessage['headers'],
): string | undefined {
  return (
    headerValue(headers, 'x-1msg-base-url') ||
    headerValue(headers, 'x-base-url')
  );
}

/** Build per-request MCP/SDK config from host env + request headers. */
export function resolveRequestConfig(
  host: HttpHostConfig,
  headers: IncomingMessage['headers'],
): McpServerConfig {
  const override = extractBaseUrlOverride(headers);
  let baseUrl: string;
  if (override) {
    try {
      baseUrl = normalizeBaseUrl(override);
    } catch {
      throw new McpAuthError(
        'Invalid X-1msg-Base-Url. Use https://api.1msg.io or https://sandbox.1msg.io',
        400,
      );
    }
    if (!isClientSelectableApiHost(baseUrl)) {
      throw new McpAuthError(
        'Unsupported X-1msg-Base-Url. Use https://api.1msg.io or https://sandbox.1msg.io',
        400,
      );
    }
  } else {
    baseUrl = normalizeBaseUrl(host.baseUrl);
  }

  return {
    baseUrl,
    token: extractBearerToken(headers),
    instanceId: extractInstanceId(headers),
  };
}
