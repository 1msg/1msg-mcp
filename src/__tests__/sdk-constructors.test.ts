import { Client, ClientConfig } from '@1msg/sdk';

describe('published @1msg/sdk exports', () => {
  it('exposes Client and ClientConfig as constructors', () => {
    expect(typeof ClientConfig).toBe('function');
    expect(typeof Client).toBe('function');

    const config = new ClientConfig({
      baseUrl: 'https://api.1msg.io',
      instanceId: 'TEST_INSTANCE',
      token: 'test-token',
    });
    expect(new Client(config)).toBeInstanceOf(Client);
  });
});
