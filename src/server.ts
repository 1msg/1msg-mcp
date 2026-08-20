import type { McpServer as McpServerType } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StdioServerTransport as StdioServerTransportType } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ChatApiClient } from '@1msg/sdk';
import type { McpServerConfig } from './config';
import { toChatApiConfig } from './config';
import { invokeGeneratedTool } from './handlers.generated';
import { GENERATED_MCP_TOOLS } from './tools.generated';
import { jsonSchemaToZod } from './json-schema-to-zod';

// CJS runtime requires explicit .js subpath exports from the MCP SDK package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js') as {
  McpServer: typeof McpServerType;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js') as {
  StdioServerTransport: typeof StdioServerTransportType;
};

const SERVER_NAME = '@1msg/mcp';
const SERVER_VERSION = '1.2.1';

function serializeToolResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  return JSON.stringify(result, null, 2);
}

function formatToolError(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybe = error as {
      message?: string;
      response?: { status?: number; statusText?: string };
      status?: number;
      statusText?: string;
      body?: unknown;
    };
    const status = maybe.response?.status ?? maybe.status;
    const statusText = maybe.response?.statusText ?? maybe.statusText;
    if (typeof status === 'number') {
      const body =
        maybe.body !== undefined
          ? ` body=${typeof maybe.body === 'string' ? maybe.body : JSON.stringify(maybe.body)}`
          : '';
      return `Chat API HTTP ${status}${statusText ? ` ${statusText}` : ''}${body}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Create MCP server with all generated Chat API tools. */
export function createMcpServer(client: ChatApiClient): McpServerType {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  for (const tool of GENERATED_MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchemaToZod(tool.inputSchema),
      },
      async (args) => {
        try {
          const result = await invokeGeneratedTool(
            client,
            tool.name,
            args as Record<string, unknown>,
          );
          return {
            content: [
              {
                type: 'text',
                text: serializeToolResult(result),
              },
            ],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: formatToolError(error),
              },
            ],
          };
        }
      },
    );
  }

  return server;
}

/** Start MCP stdio server using SDK client derived from env config. */
export async function startMcpServer(config: McpServerConfig): Promise<McpServerType> {
  const client = new ChatApiClient(toChatApiConfig(config));
  const server = createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
