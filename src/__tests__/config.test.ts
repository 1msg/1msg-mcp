import { loadMcpConfig } from '../config';

describe('loadMcpConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ONE_MSG_BASE_URL;
    delete process.env.ONE_MSG_TOKEN;
    delete process.env.ONE_MSG_INSTANCE_ID;
    delete process.env.CHAT_API_BASE_URL;
    delete process.env.CHAT_API_TOKEN;
    delete process.env.CHAT_API_INSTANCE_ID;
    delete process.env.INSTANCE_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads config from ONE_MSG_* env vars', () => {
    process.env.ONE_MSG_BASE_URL = 'https://api.stage.1msg.io';
    process.env.ONE_MSG_TOKEN = 'secret-token';
    process.env.ONE_MSG_INSTANCE_ID = 'ODI371267300';

    expect(loadMcpConfig()).toEqual({
      baseUrl: 'https://api.stage.1msg.io',
      token: 'secret-token',
      instanceId: 'ODI371267300',
    });
  });

  it('falls back to deprecated CHAT_API_* env vars', () => {
    process.env.CHAT_API_BASE_URL = 'https://api.stage.1msg.io';
    process.env.CHAT_API_TOKEN = 'secret-token';
    process.env.CHAT_API_INSTANCE_ID = 'ODI371267300';

    expect(loadMcpConfig()).toEqual({
      baseUrl: 'https://api.stage.1msg.io',
      token: 'secret-token',
      instanceId: 'ODI371267300',
    });
  });

  it('prefers ONE_MSG_* over deprecated CHAT_API_*', () => {
    process.env.ONE_MSG_BASE_URL = 'https://api.1msg.io';
    process.env.ONE_MSG_TOKEN = 'new-token';
    process.env.ONE_MSG_INSTANCE_ID = 'NEW123';
    process.env.CHAT_API_BASE_URL = 'https://api.stage.1msg.io';
    process.env.CHAT_API_TOKEN = 'old-token';
    process.env.CHAT_API_INSTANCE_ID = 'OLD123';

    expect(loadMcpConfig()).toEqual({
      baseUrl: 'https://api.1msg.io',
      token: 'new-token',
      instanceId: 'NEW123',
    });
  });

  it('accepts INSTANCE_ID alias for instance id', () => {
    process.env.ONE_MSG_BASE_URL = 'https://api.stage.1msg.io';
    process.env.ONE_MSG_TOKEN = 'secret-token';
    process.env.INSTANCE_ID = 'ODI371267300';

    expect(loadMcpConfig().instanceId).toBe('ODI371267300');
  });

  it('throws with actionable message when token is missing', () => {
    process.env.ONE_MSG_BASE_URL = 'https://api.stage.1msg.io';
    process.env.ONE_MSG_INSTANCE_ID = 'ODI371267300';

    expect(() => loadMcpConfig()).toThrow(/ONE_MSG_TOKEN/);
  });

  it('throws when instance id is missing', () => {
    process.env.ONE_MSG_BASE_URL = 'https://api.stage.1msg.io';
    process.env.ONE_MSG_TOKEN = 'secret-token';

    expect(() => loadMcpConfig()).toThrow(/INSTANCE_ID/);
  });
});
