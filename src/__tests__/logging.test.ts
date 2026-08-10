import { hashIdentifier, redactForLog } from '../logging';

describe('logging redaction', () => {
  it('redacts tokens and PII fields', () => {
    const redacted = redactForLog({
      authorization: 'Bearer abc',
      token: 'tok',
      phone: '12025550123',
      body: 'hello world',
      tool: 'send_message',
      nested: { apiKey: 'x', count: 1 },
    }) as Record<string, unknown>;

    expect(redacted.authorization).toBe('[redacted]');
    expect(redacted.token).toBe('[redacted]');
    expect(redacted.phone).toBe('[redacted-pii]');
    expect(redacted.body).toBe('[redacted-pii]');
    expect(redacted.tool).toBe('send_message');
    expect((redacted.nested as Record<string, unknown>).apiKey).toBe('[redacted]');
    expect((redacted.nested as Record<string, unknown>).count).toBe(1);
  });

  it('hashes identifiers stably', () => {
    expect(hashIdentifier('ODI1')).toBe(hashIdentifier('ODI1'));
    expect(hashIdentifier('ODI1')).not.toBe(hashIdentifier('ODI2'));
  });
});
