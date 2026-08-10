#!/usr/bin/env node

import { loadMcpConfig } from './config';
import { startMcpServer } from './server';

const PACKAGE_NAME = '@1msg/mcp';
const VERSION = '1.2.0';

function printUsage(): void {
  const lines = [
    `${PACKAGE_NAME} v${VERSION}`,
    '',
    'MCP server for the 1msg API (stdio transport).',
    '',
    'Usage:',
    `  ${PACKAGE_NAME} [--help]`,
    '',
    'Environment variables (required):',
    '  ONE_MSG_BASE_URL       API root, e.g. https://api.stage.1msg.io',
    '  ONE_MSG_TOKEN          Channel API token',
    '  ONE_MSG_INSTANCE_ID    Channel instance id',
    '',
    'Deprecated aliases still accepted: CHAT_API_BASE_URL / CHAT_API_TOKEN /',
    'CHAT_API_INSTANCE_ID (or INSTANCE_ID).',
    '',
    'The server exposes all public 1msg API operations as MCP tools',
    'and delegates HTTP calls to the @1msg/sdk package.',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return 0;
  }

  try {
    const config = loadMcpConfig();
    await startMcpServer(config);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
