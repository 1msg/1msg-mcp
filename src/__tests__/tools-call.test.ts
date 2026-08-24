/* eslint-disable @typescript-eslint/no-require-imports */
import type { Client as McpClientType } from '@modelcontextprotocol/sdk/client/index.js';
import type { InMemoryTransport as InMemoryTransportType } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { createMockChatApiClient, type MockChatApiClientBundle } from './mock-sdk';

const { Client } = require('@modelcontextprotocol/sdk/client') as {
  Client: typeof McpClientType;
};
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js') as {
  InMemoryTransport: typeof InMemoryTransportType;
};

async function connectTestMcpClient(mock: MockChatApiClientBundle) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(mock.client);
  await server.connect(serverTransport);

  const mcpClient = new Client({ name: 'mcp-test', version: '1.0.0' });
  await mcpClient.connect(clientTransport);

  return { mcpClient, server };
}

describe('createMcpServer tools/call', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches send_message to ChatApiClient.sendMessage with normalized args', async () => {
    const mock = createMockChatApiClient();
    const { mcpClient, server } = await connectTestMcpClient(mock);

    const result = await mcpClient.callTool({
      name: 'send_message',
      arguments: {
        body: 'Hello MCP',
        chatId: '79001234567@c.us',
      },
    });

    expect(mock.sendMessage).toHaveBeenCalledTimes(1);
    expect(mock.sendMessage).toHaveBeenCalledWith({
      body: 'Hello MCP',
      chatId: '79001234567@c.us',
      quotedMsgId: undefined,
      phone: undefined,
    });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0]).toMatchObject({
      type: 'text',
    });
    const text = content[0].text ?? '';
    expect(text).toContain('wamid.mock.message');

    await mcpClient.close();
    await server.close();
  });

  it('dispatches get_me to profile.getMe', async () => {
    const mock = createMockChatApiClient();
    const { mcpClient, server } = await connectTestMcpClient(mock);

    const result = await mcpClient.callTool({
      name: 'get_me',
      arguments: {},
    });

    expect(mock.getMe).toHaveBeenCalledTimes(1);
    expect(mock.getMe).toHaveBeenCalledWith('test-token');
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Test Channel');

    await mcpClient.close();
    await server.close();
  });

  it('dispatches list_messages to messaging.listMessages', async () => {
    const mock = createMockChatApiClient();
    const { mcpClient, server } = await connectTestMcpClient(mock);

    const result = await mcpClient.callTool({
      name: 'list_messages',
      arguments: {},
    });

    expect(mock.listMessages).toHaveBeenCalledTimes(1);
    expect(mock.listMessages.mock.calls[0][0]).toBe('test-token');
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('msg-1');

    await mcpClient.close();
    await server.close();
  });

  it('returns tool error content when required args are missing', async () => {
    const mock = createMockChatApiClient();
    const { mcpClient, server } = await connectTestMcpClient(mock);

    const result = await mcpClient.callTool({
      name: 'send_message',
      arguments: {},
    });

    expect(mock.sendMessage).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('body');

    await mcpClient.close();
    await server.close();
  });
});
