#!/usr/bin/env node
/**
 * Smoke test: connect to MCP server via stdio and verify tools/list.
 */
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const serverEntry = path.resolve(__dirname, '../dist/index.js');
  const env = {
    ...process.env,
    ONE_MSG_BASE_URL: process.env.ONE_MSG_BASE_URL || process.env.CHAT_API_BASE_URL || 'https://api.1msg.io',
    ONE_MSG_INSTANCE_ID: process.env.ONE_MSG_INSTANCE_ID || process.env.CHAT_API_INSTANCE_ID || 'TEST_INSTANCE',
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
    const tools = await client.listTools();
    const count = tools.tools.length;
    const names = tools.tools.map((tool) => tool.name).sort();
    const hasSendMessage = names.includes('send_message');

    console.log(`tools/list: ${count} tools`);
    console.log(`send_message present: ${hasSendMessage}`);

    if (count !== 60) {
      throw new Error(`Expected 60 tools, got ${count}`);
    }
    if (!hasSendMessage) {
      throw new Error('send_message tool missing');
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
