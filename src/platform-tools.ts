import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  PLATFORM_TOOLS,
  createPlatformClient,
  invokePlatformTool,
  type PlatformClient,
  type PlatformTool,
} from '@1msg/sdk';

import type { JsonSchema } from './tools.generated';

import { jsonSchemaToZod } from './json-schema-to-zod';

/** Build a platform client when the process has a platform key. */
export function platformClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PlatformClient | undefined {
  const apiKey = env.ONE_MSG_PLATFORM_KEY?.trim();
  if (!apiKey) return undefined;
  const baseUrl = env.ONE_MSG_PLATFORM_URL?.trim() || 'https://api.1msg.io';
  return createPlatformClient({ baseUrl, apiKey });
}

/** Build a platform client from the Cloud MCP request headers. */
export function platformClientFromHeaders(headers: {
  header(name: string): string | undefined;
}): PlatformClient | undefined {
  const apiKey = headers.header('x-1msg-platform-key')?.trim();
  if (!apiKey) return undefined;
  const baseUrl = headers.header('x-1msg-platform-url')?.trim() || 'https://api.1msg.io';
  return createPlatformClient({ baseUrl, apiKey });
}

/** Register one platform tool. HTTP stays inside @1msg/sdk. */
function registerOne(
  server: McpServer,
  platform: PlatformClient | undefined,
  tool: PlatformTool,
): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: jsonSchemaToZod(tool.inputSchema as JsonSchema),
    },
    /** Invoke the platform operation and return JSON text or the error text. */
    async (args) => {
      try {
        const result = await invokePlatformTool(
          platform,
          tool.name,
          args as Record<string, unknown>,
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    },
  );
}

/** Expose Inbox and Campaigns beside the WhatsApp tools. */
export function registerPlatformTools(
  server: McpServer,
  platform: PlatformClient | undefined,
): void {
  for (const tool of PLATFORM_TOOLS) registerOne(server, platform, tool);
}
