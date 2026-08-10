import fs from 'fs';
import path from 'path';

const MCP_SRC = path.resolve(__dirname, '..');
/** Hand-written sources that must not call Chat API over HTTP directly. */
const HANDWRITTEN_SDK_LAYER_FILES = [
  'config.ts',
  'server.ts',
  'index.ts',
  'json-schema-to-zod.ts',
  'auth.ts',
  'rate-limit.ts',
  'logging.ts',
];

/** Protocol HTTP host is allowed; still forbid outbound API clients. */
const PROTOCOL_SERVER_FILES = ['http.ts'];

const FORBIDDEN_HTTP_PATTERNS = [
  /\bfrom\s+['"]axios['"]/,
  /\bfrom\s+['"]node-fetch['"]/,
  /\brequire\s*\(\s*['"]axios['"]\s*\)/,
  /\bfetch\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bhttp\.request\s*\(/,
];

describe('MCP SDK-only architecture', () => {
  it('depends on @1msg/sdk and not on HTTP clients', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    expect(deps['@1msg/sdk']).toBeDefined();
    expect(deps).not.toHaveProperty('axios');
    expect(deps).not.toHaveProperty('node-fetch');
    expect(deps).not.toHaveProperty('got');
    expect(deps).not.toHaveProperty('undici');
  });

  it('hand-written SDK-layer files do not import or call HTTP directly', () => {
    for (const file of HANDWRITTEN_SDK_LAYER_FILES) {
      const content = fs.readFileSync(path.join(MCP_SRC, file), 'utf8');
      for (const pattern of FORBIDDEN_HTTP_PATTERNS) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('HTTP protocol host still delegates Chat API to SDK (no axios/fetch)', () => {
    for (const file of PROTOCOL_SERVER_FILES) {
      const content = fs.readFileSync(path.join(MCP_SRC, file), 'utf8');
      expect(content).toContain('ChatApiClient');
      expect(content).toContain('createMcpServer');
      expect(content).not.toMatch(/\bfrom\s+['"]axios['"]/);
      expect(content).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('generated handlers delegate to ChatApiClient only', () => {
    const handlersPath = path.join(MCP_SRC, 'handlers.generated.ts');
    const content = fs.readFileSync(handlersPath, 'utf8');

    expect(content).toContain('ChatApiClient');
    expect(content).toMatch(/client\.(messaging|profile|groups|flows|templates)\./);
    expect(content).toMatch(/client\.sendMessage\(/);

    for (const pattern of FORBIDDEN_HTTP_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });

  it('server wires tools through invokeGeneratedTool(client, ...)', () => {
    const content = fs.readFileSync(path.join(MCP_SRC, 'server.ts'), 'utf8');
    expect(content).toContain('invokeGeneratedTool');
    expect(content).toContain('ChatApiClient');
    expect(content).not.toMatch(/\bfetch\s*\(/);
  });
});
