import { ChatApiConfig, type ChatApiClient } from '@1msg/sdk';

export interface MockChatApiClientMocks {
  sendMessage: jest.Mock;
  getMe: jest.Mock;
  listMessages: jest.Mock;
}

export interface MockChatApiClientBundle extends MockChatApiClientMocks {
  client: ChatApiClient;
}

/** Jest mock ChatApiClient with call tracking for MCP integration tests. */
export function createMockChatApiClient(): MockChatApiClientBundle {
  const config = new ChatApiConfig({
    baseUrl: 'https://api.1msg.io',
    instanceId: 'TEST_INSTANCE',
    token: 'test-token',
  });

  const sendMessage = jest.fn().mockResolvedValue({
    sent: true,
    id: 'wamid.mock.message',
    message: 'queued',
  });

  const getMe = jest.fn().mockResolvedValue({
    name: 'Test Channel',
    phone: '79001234567',
  });

  const listMessages = jest.fn().mockResolvedValue({
    messages: [{ id: 'msg-1', body: 'hello' }],
  });

  const client = {
    config,
    sendMessage,
    messaging: {
      listMessages,
    },
    profile: {
      getMe,
    },
    flows: {},
    groups: {},
    templates: {},
  } as unknown as ChatApiClient;

  return { client, sendMessage, getMe, listMessages };
}
