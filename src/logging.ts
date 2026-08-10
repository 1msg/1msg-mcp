const REDACT_KEYS = new Set([
  'authorization',
  'token',
  'apitoken',
  'api_key',
  'apikey',
  'chat_api_token',
  'x-api-key',
  'password',
  'secret',
]);

const PII_KEYS = new Set([
  'phone',
  'body',
  'text',
  'message',
  'chatid',
  'chat_id',
  'email',
  'name',
  'caption',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Deep-clone value while redacting secrets and obvious PII fields. */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[truncated]';
  }
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > 200) {
      return `${value.slice(0, 32)}…[len=${value.length}]`;
    }
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactForLog(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeKey(key);
    if (REDACT_KEYS.has(normalized) || REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    if (PII_KEYS.has(normalized)) {
      out[key] = '[redacted-pii]';
      continue;
    }
    out[key] = redactForLog(child, depth + 1);
  }
  return out;
}

export interface RequestLogFields {
  requestId: string;
  method?: string;
  path?: string;
  status?: number;
  tool?: string;
  instanceIdHash?: string;
  latencyMs?: number;
  error?: string;
  [key: string]: unknown;
}

/** Structured JSON log line to stdout (never includes raw tokens). */
export function logRequest(fields: RequestLogFields): void {
  const safe = redactForLog(fields) as Record<string, unknown>;
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...safe })}\n`);
}

/** Short non-reversible id hash for correlation (not the real instance id). */
export function hashIdentifier(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
