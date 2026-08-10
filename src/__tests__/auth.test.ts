import type { IncomingMessage } from 'node:http';
import {
  extractBearerToken,
  extractInstanceId,
  McpAuthError,
  resolveRequestConfig,
} from '../auth';

function headers(map: Record<string, string>): IncomingMessage['headers'] {
  const out: IncomingMessage['headers'] = {};
  for (const [key, value] of Object.entries(map)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

describe('MCP HTTP auth', () => {
  it('extracts Bearer token', () => {
    expect(extractBearerToken(headers({ authorization: 'Bearer secret-token' }))).toBe(
      'secret-token',
    );
  });

  it('accepts X-API-Key', () => {
    expect(extractBearerToken(headers({ 'x-api-key': 'key-1' }))).toBe('key-1');
  });

  it('accepts X-1msg-Instance-Id alias', () => {
    expect(extractInstanceId(headers({ 'x-1msg-instance-id': 'ODI2' }))).toBe(
      'ODI2',
    );
  });

  it('accepts deprecated X-Chat-Api-Instance-Id alias', () => {
    expect(
      extractInstanceId(headers({ 'x-chat-api-instance-id': 'ODI3' })),
    ).toBe('ODI3');
  });

  it('requires instance id header', () => {
    expect(() => extractInstanceId(headers({}))).toThrow(McpAuthError);
    expect(extractInstanceId(headers({ 'x-instance-id': 'ODI1' }))).toBe('ODI1');
  });

  it('builds request config from host + headers', () => {
    const config = resolveRequestConfig(
      { baseUrl: 'https://api.stage.1msg.io' },
      headers({
        authorization: 'Bearer tok',
        'x-instance-id': 'INST',
      }),
    );
    expect(config).toEqual({
      baseUrl: 'https://api.stage.1msg.io',
      token: 'tok',
      instanceId: 'INST',
    });
  });
});
