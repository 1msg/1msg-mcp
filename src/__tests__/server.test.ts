import type { ChatApiClient } from '@1msg/sdk';
import { createMcpServer } from '../server';

// CJS subpath exports from @modelcontextprotocol/sdk
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('@modelcontextprotocol/sdk/client/index.js') as {
  Client: typeof import('@modelcontextprotocol/sdk/client/index.js').Client;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js') as {
  InMemoryTransport: typeof import('@modelcontextprotocol/sdk/inMemory.js').InMemoryTransport;
};

function createMockClient(): ChatApiClient {
  return {
    config: { token: 'test-api-token' },
    sendMessage: jest.fn().mockResolvedValue({ sent: true, id: 'msg-1' }),
    profile: {
      getMe: jest.fn().mockResolvedValue({ id: 'me' }),
    },
    messaging: {
      listMessages: jest.fn().mockResolvedValue({ messages: [] }),
      sendButton: jest.fn(),
      sendCarousel: jest.fn(),
      sendContact: jest.fn(),
      sendFile: jest.fn(),
      sendFlow: jest.fn(),
      sendList: jest.fn(),
      sendLocation: jest.fn(),
      sendLocationRequest: jest.fn(),
      sendProduct: jest.fn(),
      sendReaction: jest.fn(),
      createReadMessage: jest.fn(),
      createUploadMedia: jest.fn(),
    },
    flows: {
      createFlows: jest.fn(),
      createFlowsFlowIdDeprecate: jest.fn(),
      createFlowsFlowIdPublish: jest.fn(),
      deleteFlowsFlowId: jest.fn(),
      getFlowsFlowId: jest.fn(),
      getFlowsFlowIdPreview: jest.fn(),
      listFlows: jest.fn(),
      patchFlowsFlowIdAssets: jest.fn(),
      patchFlowsFlowIdMetadata: jest.fn(),
    },
    groups: {
      createGroups: jest.fn(),
      createGroupsGroupId: jest.fn(),
      createGroupsGroupIdInvitelink: jest.fn(),
      deleteGroupsGroupId: jest.fn(),
      getGroupsGroupId: jest.fn(),
      getGroupsGroupIdInvitelink: jest.fn(),
      listGroups: jest.fn(),
    },
    templates: {
      listTemplates: jest.fn().mockResolvedValue({ templates: [] }),
      sendTemplate: jest.fn(),
    },
  } as unknown as ChatApiClient;
}

describe('createMcpServer tools/list', () => {
  it('returns all generated tools over MCP protocol', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer(createMockClient());
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();

    expect(tools.tools).toHaveLength(60);
    expect(names).toContain('send_message');
    expect(names).toContain('get_me');
    expect(names).toContain('list_templates');

    await client.close();
    await server.close();
  });
});

describe('createMcpServer tools/call', () => {
  it('invokes send_message through MCP and returns JSON result', async () => {
    const mockClient = createMockClient();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer(mockClient);
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'send_message',
      arguments: {
        body: 'Hello via MCP',
        chatId: '12020721369@c.us',
      },
    });

    expect(mockClient.sendMessage).toHaveBeenCalledWith({
      body: 'Hello via MCP',
      chatId: '12020721369@c.us',
      quotedMsgId: undefined,
      phone: undefined,
    });
    const content = result.content as Array<{ type: string }> | undefined;
    expect(content?.[0]).toMatchObject({ type: 'text' });

    await client.close();
    await server.close();
  });
});
