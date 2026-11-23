#!/usr/bin/env node
const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
/**
 * Smoke test: connect to MCP server via stdio and verify tools/list.
 */
const path = require('node:path');

/** Connect over stdio and require the WhatsApp tools plus the platform tools. */
async function main() {
  const serverEntry = path.resolve(__dirname, '../dist/index.js');
  const env = {
    ...process.env,
    ONE_MSG_BASE_URL:
      process.env.ONE_MSG_BASE_URL || process.env.CHAT_API_BASE_URL || 'https://api.1msg.io',
    ONE_MSG_INSTANCE_ID:
      process.env.ONE_MSG_INSTANCE_ID || process.env.CHAT_API_INSTANCE_ID || 'TEST_INSTANCE',
    ONE_MSG_TOKEN: process.env.ONE_MSG_TOKEN || process.env.CHAT_API_TOKEN || 'test-token',
  };

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env,
  });

  const client = new Client({ name: 'mcp-smoke-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const { PLATFORM_TOOLS } = require('@1msg/sdk');
    const tools = await client.listTools();
    const count = tools.tools.length;
    const names = tools.tools.map((tool) => tool.name).sort();
    const expected = 62 + PLATFORM_TOOLS.length;
    const required = ['send_message', 'platform_list_inbox_channels', 'platform_list_campaigns'];

    console.log(`tools/list: ${count} tools`);
    console.log(`expected: ${expected}`);

    if (count !== expected) {
      throw new Error(`Expected ${expected} tools, got ${count}`);
    }
    for (const name of required) {
      if (!names.includes(name)) throw new Error(`${name} tool missing`);
    }

    console.log('Smoke test passed');
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('Smoke test failed:', error.message || error);
  process.exit(1);
});
