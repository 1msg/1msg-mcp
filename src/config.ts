import { ChatApiConfig, type ChatApiConfigOptions } from '@1msg/sdk';

export interface McpServerConfig extends ChatApiConfigOptions {
  baseUrl: string;
  instanceId: string;
  token: string;
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
    'Prefer ONE_MSG_BASE_URL, ONE_MSG_TOKEN, and ONE_MSG_INSTANCE_ID.',
    'Deprecated aliases still work: CHAT_API_BASE_URL, CHAT_API_TOKEN, CHAT_API_INSTANCE_ID (or INSTANCE_ID).',
    'Example:',
    '  ONE_MSG_BASE_URL=https://api.stage.1msg.io \\',
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
    missing.push('ONE_MSG_BASE_URL (or deprecated CHAT_API_BASE_URL)');
  }

  const token = readEnv('ONE_MSG_TOKEN', [
    'CHAT_API_TOKEN',
    'CHAT_API_KEY',
    'TOKEN',
  ]);
  if (!token) {
    missing.push('ONE_MSG_TOKEN (or deprecated CHAT_API_TOKEN)');
  }

  const instanceId = readEnv('ONE_MSG_INSTANCE_ID', [
    'CHAT_API_INSTANCE_ID',
    'INSTANCE_ID',
  ]);
  if (!instanceId) {
    missing.push('ONE_MSG_INSTANCE_ID (or deprecated CHAT_API_INSTANCE_ID / INSTANCE_ID)');
  }

  if (missing.length > 0) {
    throw new Error(missingEnvMessage(missing));
  }

  return {
    baseUrl: baseUrl!,
    instanceId: instanceId!,
    token: token!,
  };
}

/** Build SDK ChatApiConfig from MCP env config. */
export function toChatApiConfig(config: McpServerConfig): ChatApiConfig {
  return new ChatApiConfig({
    baseUrl: config.baseUrl,
    instanceId: config.instanceId,
    token: config.token,
  });
}
