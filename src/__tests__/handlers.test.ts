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
      sendContact: jest.fn().mockResolvedValue({ sent: true }),
      sendCarousel: jest.fn().mockResolvedValue({ sent: true }),
      createUploadMedia: jest.fn().mockResolvedValue({ mediaId: '123' }),
      deleteMedia: jest.fn().mockResolvedValue({ result: 'success' }),
    },
    channel: {
      listSettings: jest.fn().mockResolvedValue({ webhookUrl: [] }),
      createSettings: jest.fn().mockResolvedValue({ success: true }),
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

    expect(client.templates.listTemplates).toHaveBeenCalledWith(
      'test-api-token',
      undefined,
      undefined,
      undefined,
    );
  });

  it('wraps send_contact.contact into contacts[] so the published SDK keeps the card', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'send_contact', {
      phone: '79181976551',
      contact: { name: 'Lida', phone: '+79181976551' },
    });

    expect(client.messaging.sendContact).toHaveBeenCalledWith(
      'test-api-token',
      expect.objectContaining({
        phone: '79181976551',
        contacts: [
          expect.objectContaining({
            name: { formatted_name: 'Lida', first_name: 'Lida' },
            phones: [{ phone: '+79181976551', type: 'CELL' }],
          }),
        ],
      }),
    );
    expect((client.messaging.sendContact as jest.Mock).mock.calls[0][1]).not.toHaveProperty(
      'contact',
    );
  });

  it('wraps send_carousel.cards into params', async () => {
    const client = createMockClient();
    const cards = [{ body: 'one' }, { body: 'two' }];

    await invokeGeneratedTool(client, 'send_carousel', {
      phone: '79181976551',
      cards,
    });

    expect(client.messaging.sendCarousel).toHaveBeenCalledWith(
      'test-api-token',
      [{ type: 'CAROUSEL', cards }],
      undefined,
      undefined,
      undefined,
      79181976551,
    );
  });

  it('maps create_upload_media.url onto body', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'create_upload_media', {
      url: 'https://example.com/file.pdf',
    });

    expect(client.messaging.createUploadMedia).toHaveBeenCalledWith(
      'test-api-token',
      expect.objectContaining({
        body: 'https://example.com/file.pdf',
        url: 'https://example.com/file.pdf',
      }),
    );
  });

  it('delegates list_settings and create_settings to channel', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'list_settings', {});
    expect((client.channel as unknown as { listSettings: jest.Mock }).listSettings).toHaveBeenCalledWith(
      'test-api-token',
    );

    await invokeGeneratedTool(client, 'create_settings', {
      webhookUrl: 'https://example.com/hook',
    });
    expect(
      (client.channel as unknown as { createSettings: jest.Mock }).createSettings,
    ).toHaveBeenCalledWith(
      'test-api-token',
      expect.objectContaining({ webhookUrl: 'https://example.com/hook' }),
    );

    await invokeGeneratedTool(client, 'create_settings', {
      webhookUrl: ['https://a.example/hook', 'https://b.example/hook'],
      guaranteedHooks: true,
    });
    expect(
      (client.channel as unknown as { createSettings: jest.Mock }).createSettings,
    ).toHaveBeenCalledWith(
      'test-api-token',
      expect.objectContaining({
        webhookUrl: ['https://a.example/hook', 'https://b.example/hook'],
        guaranteedHooks: true,
      }),
    );
  });

  it('calls delete_media as deleteMedia(token, mediaId)', async () => {
    const client = createMockClient();

    await invokeGeneratedTool(client, 'delete_media', { mediaId: '1597399065095084' });
    expect(
      (client.messaging as unknown as { deleteMedia: jest.Mock }).deleteMedia,
    ).toHaveBeenCalledWith('test-api-token', '1597399065095084');
  });
});

describe('GENERATED_MCP_TOOLS', () => {
  it('exposes 62 public API tools including send_message', () => {
    expect(GENERATED_MCP_TOOLS).toHaveLength(62);

    const sendMessage = GENERATED_MCP_TOOLS.find((tool) => tool.name === 'send_message');
    expect(sendMessage).toBeDefined();
    expect(sendMessage?.operationId).toBe('sendMessage');
    expect(sendMessage?.inputSchema.required).toContain('body');
  });
});
