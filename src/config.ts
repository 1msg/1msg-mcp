import { ClientConfig, type ClientConfigOptions } from '@1msg/sdk';

export interface McpServerConfig extends ClientConfigOptions {
  baseUrl: string;
  instanceId: string;
  token: string;
}

/** Public API hosts customers may select (live or test channels). */
const PUBLIC_API_HOSTS = new Set(['api.1msg.io', 'sandbox.1msg.io']);

const PUBLIC_API_HOST_ALIASES: Record<string, string> = {
  'api.1msg.io': 'api.1msg.io',
  'www.api.1msg.io': 'api.1msg.io',
  'sandbox.1msg.io': 'sandbox.1msg.io',
  'www.sandbox.1msg.io': 'sandbox.1msg.io',
  'api.sandbox.1msg.io': 'sandbox.1msg.io',
};

/**
 * Normalize a 1MSG API root.
 *
 * Accepts `https://sandbox.1msg.io`, `http://sandbox.1msg.io`, or `sandbox.1msg.io`.
 * Strips trailing slash and instance-id path (instance is a separate field).
 */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('ONE_MSG_BASE_URL must not be empty.');
  }

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(
      `Invalid ONE_MSG_BASE_URL '${raw}'. Use https://api.1msg.io or https://sandbox.1msg.io`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid ONE_MSG_BASE_URL protocol '${parsed.protocol}'. Use https://api.1msg.io or https://sandbox.1msg.io`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const canonical = PUBLIC_API_HOST_ALIASES[hostname];
  if (canonical) {
    return `https://${canonical}`;
  }

  const protocol = hostname.endsWith('.1msg.io') ? 'https:' : parsed.protocol;
  const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
  return `${protocol}//${host}`;
}

/** True when Cloud clients may send this host via X-1msg-Base-Url. */
export function isClientSelectableApiHost(baseUrl: string): boolean {
  try {
    const host = new URL(normalizeBaseUrl(baseUrl)).hostname.toLowerCase();
    return PUBLIC_API_HOSTS.has(host);
  } catch {
    return false;
  }
}

function readEnv(name: string, aliases: string[] = []): string | undefined {
  const keys = [name, ...aliases];
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function missingEnvMessage(missing: string[]): string {
  return [
    'Missing required environment variables for @1msg/mcp:',
    ...missing.map((name) => `  - ${name}`),
    '',
    'Set ONE_MSG_BASE_URL, ONE_MSG_TOKEN, and ONE_MSG_INSTANCE_ID.',
    'Live channels: ONE_MSG_BASE_URL=https://api.1msg.io',
    'Test channels: ONE_MSG_BASE_URL=https://sandbox.1msg.io',
    'Example:',
    '  ONE_MSG_BASE_URL=https://api.1msg.io \\',
    '  ONE_MSG_INSTANCE_ID=ODI371267300 \\',
    '  ONE_MSG_TOKEN=your-token \\',
    '  npx @1msg/mcp',
  ].join('\n');
}

/** Load MCP server configuration from environment variables. */
export function loadMcpConfig(): McpServerConfig {
  const missing: string[] = [];

  const baseUrl = readEnv('ONE_MSG_BASE_URL', [
    'CHAT_API_BASE_URL',
    'CHAT_API_ROOT_URL',
    'CHAT_API_URL',
  ]);
  if (!baseUrl) {
    missing.push('ONE_MSG_BASE_URL');
  }

  const token = readEnv('ONE_MSG_TOKEN', [
    'CHAT_API_TOKEN',
    'CHAT_API_KEY',
    'TOKEN',
  ]);
  if (!token) {
    missing.push('ONE_MSG_TOKEN');
  }

  const instanceId = readEnv('ONE_MSG_INSTANCE_ID', [
    'CHAT_API_INSTANCE_ID',
    'INSTANCE_ID',
  ]);
  if (!instanceId) {
    missing.push('ONE_MSG_INSTANCE_ID');
  }

  if (missing.length > 0) {
    throw new Error(missingEnvMessage(missing));
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl!),
    instanceId: instanceId!,
    token: token!,
  };
}

/** Build SDK ClientConfig from MCP env config. */
export function toClientConfig(config: McpServerConfig): ClientConfig {
  return new ClientConfig({
    baseUrl: config.baseUrl,
    instanceId: config.instanceId,
    token: config.token,
  });
}
