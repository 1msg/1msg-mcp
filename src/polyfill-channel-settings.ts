type ChannelSettingsClient = {
  config: { buildRequestUrl?: (path: string) => string };
  channel?: object;
  messaging?: object;
  webhooks?: object;
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

function pickNumericMediaId(first: unknown, second?: unknown): string {
  for (const value of [first, second]) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const asInt = String(Math.trunc(value));
      if (/^\d+$/.test(asInt)) return asInt;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return value.trim();
    }
  }
  throw new Error('mediaId must be a numeric WABA media id');
}

async function postJsonSafe(
  buildUrl: (path: string) => string,
  path: string,
  payload: unknown,
): Promise<unknown> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  return readJson(response);
}

function contactNameForApi(name: unknown): unknown {
  if (typeof name === 'string') {
    return { formatted_name: name, first_name: name.split(/\s+/)[0] };
  }
  if (!name || typeof name !== 'object') {
    return name;
  }
  const raw = name as Record<string, unknown>;
  const formatted = raw.formatted_name ?? raw.formattedName;
  const first =
    raw.first_name ??
    raw.firstName ??
    (formatted != null ? String(formatted).split(/\s+/)[0] : undefined);
  const last = raw.last_name ?? raw.lastName;
  const out: Record<string, unknown> = {};
  if (formatted != null) out.formatted_name = formatted;
  if (first != null) out.first_name = first;
  if (last != null) out.last_name = last;
  for (const [key, value] of Object.entries(raw)) {
    if (['formattedName', 'firstName', 'lastName', 'middleName'].includes(key)) {
      continue;
    }
    if (out[key] === undefined) out[key] = value;
  }
  return out;
}

function sendContactPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }
  const payload = { ...(body as Record<string, unknown>) };
  if (Array.isArray(payload.contacts)) {
    payload.contacts = payload.contacts.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const contact = { ...(item as Record<string, unknown>) };
      contact.name = contactNameForApi(contact.name);
      return contact;
    });
  }
  return payload;
}

function sendCarouselPayload(
  params: unknown,
  body?: unknown,
  quotedMsgId?: unknown,
  chatId?: unknown,
  phone?: unknown,
): Record<string, unknown> {
  if (
    params &&
    typeof params === 'object' &&
    !Array.isArray(params) &&
    ('cards' in params || 'params' in params || 'phone' in params || 'chatId' in params)
  ) {
    return { ...(params as Record<string, unknown>) };
  }

  const payload: Record<string, unknown> = {};
  if (body !== undefined) payload.body = body;
  if (quotedMsgId !== undefined) payload.quotedMsgId = quotedMsgId;
  if (chatId !== undefined) payload.chatId = chatId;
  if (phone !== undefined) payload.phone = phone;
  if (Array.isArray(params)) {
    payload.params = params;
    const carousel = params.find(
      (item) => item && typeof item === 'object' && (item as { type?: string }).type === 'CAROUSEL',
    ) as { cards?: unknown } | undefined;
    if (carousel?.cards) {
      payload.cards = carousel.cards;
    }
  }
  return payload;
}

/**
 * GET/POST /settings exist on the live API but were missing from public OpenAPI,
 * so older @1msg/sdk builds have no ChannelApi.listSettings / createSettings.
 * Fill them in from ClientConfig so MCP tools work before the next SDK publish.
 *
 * Published createUploadMedia is void and drops `url` — always wrap with fetch.
 * Published sendContact/sendCarousel ToJSON drops snake_case name fields and
 * nested `cards` — POST raw JSON instead.
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

  // Always POST raw JSON so webhookUrl arrays survive published SDK ToJSON.
  channel.createSettings = async (_token: string, settings?: unknown) => {
    return postJsonSafe(buildUrl, '/settings', settings);
  };

  if (!client.webhooks) {
    client.webhooks = {};
  }
  const webhooks = client.webhooks as {
    setWebhook?: (token: string, body?: unknown) => Promise<unknown>;
  };
  webhooks.setWebhook = async (_token: string, body?: unknown) => {
    return postJsonSafe(buildUrl, '/webhook', body);
  };

  if (!client.messaging) {
    client.messaging = {};
  }
  const messaging = client.messaging as {
    createUploadMedia?: (token: string, body?: unknown) => Promise<unknown>;
    deleteMedia?: (tokenOrMediaId: string, mediaIdOrToken?: string) => Promise<unknown>;
    sendContact?: (token: string, body?: unknown) => Promise<unknown>;
    sendCarousel?: (
      token: string,
      params?: unknown,
      body?: unknown,
      quotedMsgId?: unknown,
      chatId?: unknown,
      phone?: unknown,
    ) => Promise<unknown>;
  };

  messaging.deleteMedia = async (first: string, second?: string) => {
    const mediaId = pickNumericMediaId(first, second);
    const response = await fetch(buildUrl(`/media/${encodeURIComponent(mediaId)}`), {
      method: 'DELETE',
    });
    if (response.ok) {
      const text = await response.text();
      return text ? JSON.parse(text) : { result: 'success' };
    }
    return postJsonSafe(buildUrl, '/deleteMedia', { mediaId });
  };

  messaging.createUploadMedia = async (_token: string, body?: unknown) => {
    const payload: Record<string, unknown> =
      body && typeof body === 'object' && body !== null
        ? { ...(body as Record<string, unknown>) }
        : { body };
    if (typeof payload.url === 'string' && (payload.body === undefined || payload.body === '')) {
      payload.body = payload.url;
    }
    return postJsonSafe(buildUrl, '/uploadMedia', payload);
  };

  messaging.sendContact = async (_token: string, body?: unknown) => {
    return postJsonSafe(buildUrl, '/sendContact', sendContactPayload(body));
  };

  messaging.sendCarousel = async (
    _token: string,
    params?: unknown,
    body?: unknown,
    quotedMsgId?: unknown,
    chatId?: unknown,
    phone?: unknown,
  ) => {
    return postJsonSafe(
      buildUrl,
      '/sendCarousel',
      sendCarouselPayload(params, body, quotedMsgId, chatId, phone),
    );
  };
}
