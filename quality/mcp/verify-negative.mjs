import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
const file = 'src/tools.generated.ts';
const unexpected = 'src/quality-fixture.generated.ts';
const original = readFileSync(file);
const ignore = readFileSync('.gitignore');
/** Execute the real producer and require specifically a drift failure, never an unrelated tool or dependency failure. */
function rejectDrift() {
  const result = spawnSync(process.execPath, ['quality/mcp/generate.mjs'], {
    encoding: 'utf8',
    timeout: 120000,
  });
  assert.notEqual(result.status, 0, 'MCP regeneration accepted modified output');
  assert.match(result.stderr + result.stdout, /Generated drift/);
}
try {
  writeFileSync(file, Buffer.concat([original, Buffer.from('\n// drift fixture\n')]));
  rejectDrift();
  rmSync(file);
  rejectDrift();
  writeFileSync(file, original);
  writeFileSync('.gitignore', Buffer.concat([ignore, Buffer.from(`\n/${unexpected}\n`)]));
  writeFileSync(unexpected, 'export const unexpected = true;\n');
  rejectDrift();
  console.log('Real MCP generation rejects changed, deleted and ignored/untracked output');
} finally {
  writeFileSync(file, original);
  writeFileSync('.gitignore', ignore);
  rmSync(unexpected, { force: true });
}
