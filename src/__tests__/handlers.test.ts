import type { ChatApiClient } from '@1msg/sdk';
import { invokeGeneratedTool } from '../handlers.generated';
import { GENERATED_MCP_TOOLS } from '../tools.generated';

function createMockClient(): ChatApiClient {
  return {
    config: { token: 'test-api-token' },
    sendMessage: jest.fn().mockResolvedValue({ sent: true, id: 'msg-1' }),
    profile: {
      getMe: jest.fn().mockResolvedValue({ id: 'me', pushname: 'Test' }),
    },
    messaging: {
      listMessages: jest.fn().mockResolvedValue({ messages: [] }),
    },
    templates: {
      listTemplates: jest.fn().mockResolvedValue({ templates: [] }),
    },
  } as unknown as ChatApiClient;
}

describe('invokeGeneratedTool', () => {
  it('delegates send_message to ChatApiClient.sendMessage', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'send_message', {
      body: 'Hello MCP',
      chatId: '12020721369@c.us',
    });

    expect(client.sendMessage).toHaveBeenCalledWith({
      body: 'Hello MCP',
      chatId: '12020721369@c.us',
      quotedMsgId: undefined,
      phone: undefined,
    });
  });

  it('delegates get_me to profile.getMe with token', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'get_me', {});

    expect(client.profile.getMe).toHaveBeenCalledWith('test-api-token');
  });

  it('delegates list_templates to templates.listTemplates', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'list_templates', {});

    expect(client.templates.listTemplates).toHaveBeenCalledWith('test-api-token');
  });
});

describe('GENERATED_MCP_TOOLS', () => {
  it('exposes 35 public API tools including send_message', () => {
    expect(GENERATED_MCP_TOOLS).toHaveLength(60);

    const sendMessage = GENERATED_MCP_TOOLS.find((tool) => tool.name === 'send_message');
    expect(sendMessage).toBeDefined();
    expect(sendMessage?.operationId).toBe('sendMessage');
    expect(sendMessage?.inputSchema.required).toContain('body');
  });
});
