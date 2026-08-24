type ChannelSettingsClient = {
  config: { buildRequestUrl?: (path: string) => string };
  channel?: object;
  messaging?: object;
};

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Chat API HTTP ${response.status} ${response.statusText}${text ? ` body=${text}` : ''}`,
    );
  }
  return response.json();
}

/**
 * GET/POST /settings exist on the live API but were missing from public OpenAPI,
 * so older @1msg/sdk builds have no ChannelApi.listSettings / createSettings.
 * Fill them in from ClientConfig so MCP tools work before the next SDK publish.
 *
 * Published createUploadMedia is void and drops `url` — always wrap with fetch.
 */
export function polyfillChannelSettings(client: ChannelSettingsClient): void {
  const buildUrl = client.config.buildRequestUrl?.bind(client.config);
  if (typeof buildUrl !== 'function') {
    return;
  }

  if (!client.channel) {
    client.channel = {};
  }
  const channel = client.channel as {
    listSettings?: (token: string) => Promise<unknown>;
    createSettings?: (token: string, settings?: unknown) => Promise<unknown>;
  };

  if (typeof channel.listSettings !== 'function') {
    channel.listSettings = async () => {
      return readJson(await fetch(buildUrl('/settings')));
    };
  }

  if (typeof channel.createSettings !== 'function') {
    channel.createSettings = async (_token: string, settings?: unknown) => {
      return readJson(
        await fetch(buildUrl('/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings ?? {}),
        }),
      );
    };
  }

  if (!client.messaging) {
    client.messaging = {};
  }
  const messaging = client.messaging as {
    createUploadMedia?: (token: string, body?: unknown) => Promise<unknown>;
  };
  messaging.createUploadMedia = async (_token: string, body?: unknown) => {
    const payload: Record<string, unknown> =
      body && typeof body === 'object' && body !== null
        ? { ...(body as Record<string, unknown>) }
        : { body };
    if (typeof payload.url === 'string' && (payload.body === undefined || payload.body === '')) {
      payload.body = payload.url;
    }
    return readJson(
      await fetch(buildUrl('/uploadMedia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
  };
}
