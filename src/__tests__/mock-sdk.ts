import { ClientConfig, type Client } from '@1msg/sdk';

export interface MockChatApiClientMocks {
  sendMessage: jest.Mock<Promise<unknown>, unknown[]>;
  getMe: jest.Mock<Promise<unknown>, unknown[]>;
  listMessages: jest.Mock<Promise<unknown>, unknown[]>;
}

export interface MockChatApiClientBundle extends MockChatApiClientMocks {
  client: Client;
}

/** Jest mock Client with call tracking for MCP integration tests. */
export function createMockChatApiClient(): MockChatApiClientBundle {
  const config = new ClientConfig({
    baseUrl: 'https://api.1msg.io',
    instanceId: 'TEST_INSTANCE',
    token: 'test-token',
  });

  const sendMessage = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({
    sent: true,
    id: 'wamid.mock.message',
    message: 'queued',
  });

  const getMe = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({
    name: 'Test Channel',
    phone: '79001234567',
  });

  const listMessages = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({
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
  } as unknown as Client;

  return { client, sendMessage, getMe, listMessages };
}
