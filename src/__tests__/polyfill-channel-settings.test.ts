import { polyfillChannelSettings } from '../polyfill-channel-settings';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('polyfillChannelSettings', () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    calls.length = 0;
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ sent: true, path: String(url) });
    }) as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs send_contact JSON with formatted_name, not camelCase', async () => {
    const client = {
      config: { buildRequestUrl: (path: string) => `https://api.test${path}` },
      messaging: {},
    };
    polyfillChannelSettings(client);

    await (
      client.messaging as {
        sendContact: (token: string, body: unknown) => Promise<unknown>;
      }
    ).sendContact('tok', {
      phone: '79001234567',
      contacts: [{ name: { formattedName: 'Lida', firstName: 'Lida' }, phones: [{ phone: '+1' }] }],
    });

    expect(calls[0]?.url).toBe('https://api.test/sendContact');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      phone: '79001234567',
      contacts: [
        {
          name: { formatted_name: 'Lida', first_name: 'Lida' },
          phones: [{ phone: '+1' }],
        },
      ],
    });
  });

  it('POSTs send_carousel JSON with cards copied out of CAROUSEL params', async () => {
    const client = {
      config: { buildRequestUrl: (path: string) => `https://api.test${path}` },
      messaging: {},
    };
    polyfillChannelSettings(client);
    const cards = [{ body: 'one' }, { body: 'two' }];

    await (
      client.messaging as {
        sendCarousel: (
          token: string,
          params: unknown,
          body?: unknown,
          quotedMsgId?: unknown,
          chatId?: unknown,
          phone?: unknown,
        ) => Promise<unknown>;
      }
    ).sendCarousel('tok', [{ type: 'CAROUSEL', cards }], 'Pick', undefined, undefined, 79001234567);

    expect(calls[0]?.url).toBe('https://api.test/sendCarousel');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      params: [{ type: 'CAROUSEL', cards }],
      body: 'Pick',
      phone: 79001234567,
      cards,
    });
  });

  it('POSTs create_settings webhookUrl array as JSON even if SDK method exists', async () => {
    const original = jest.fn();
    const client = {
      config: { buildRequestUrl: (path: string) => `https://api.test${path}` },
      channel: {
        createSettings: original,
      },
    };
    polyfillChannelSettings(client);

    const urls = ['https://a.test/hook', 'https://b.test/hook'];
    await (
      client.channel as {
        createSettings: (token: string, body: unknown) => Promise<unknown>;
      }
    ).createSettings('tok', { webhookUrl: urls, guaranteedHooks: true });

    expect(original).not.toHaveBeenCalled();
    expect(calls[0]?.url).toBe('https://api.test/settings');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      webhookUrl: urls,
      guaranteedHooks: true,
    });
  });
});
