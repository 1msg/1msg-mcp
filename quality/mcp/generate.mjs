import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const metadata = JSON.parse(await readFile(join(directory, 'provenance.json'), 'utf8'));
/** Hash complete bytes so a producer, contract or SDK-signature edit requires explicit provenance review. */
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const producer = join(directory, 'vendor/generate-mcp-tools.cjs');
assert.equal(
  hash(await readFile(producer)),
  metadata.producerSha256,
  'Pinned producer checksum mismatch',
);
const specPath = join(directory, 'openapi.yaml');
const specBytes = await readFile(specPath);
assert.equal(hash(specBytes), metadata.contractSha256, 'Pinned public contract checksum mismatch');
const spec = YAML.parse(specBytes.toString());
assert.ok(Object.keys(spec.paths ?? {}).length, 'Pinned contract has no operations');
const sdk = join(root, 'node_modules/@1msg/sdk');
assert.equal(
  JSON.parse(await readFile(join(sdk, 'package.json'), 'utf8')).version,
  metadata.sdkVersion,
  'Published SDK version changed; review compatibility exception and wire coverage',
);
const signatures = join(directory, 'vendor/apis');
assert.ok(Object.keys(metadata.sdkSignatures).length, 'SDK signature inventory cannot be empty');
for (const [name, expected] of Object.entries(metadata.sdkSignatures)) {
  assert.equal(
    hash(await readFile(join(signatures, name))),
    expected,
    `SDK signature changed: ${name}`,
  );
}

/** Read operation parameter lists from a generated SDK interface without executing the client or making requests. */
function parameterLists(source) {
  const body = source.match(/export interface \w+ApiInterface \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'SDK operation interface missing');
  const result = {};
  for (const match of body.matchAll(/^\s+(\w+)\(([^)]*)\):/gm)) {
    const [, name, parameters] = match;
    if (name.endsWith('Raw') || name.endsWith('RequestOpts')) continue;
    result[name] = parameters
      .split(',')
      .map((parameter) => parameter.trim().split(':')[0])
      .filter((name) => name && !name.startsWith('initOverrides'));
  }
  return result;
}

const exception = JSON.parse(
  await readFile(join(directory, 'sdk-compatibility-exception.json'), 'utf8'),
);
assert.ok(
  exception.owner && exception.issue,
  'SDK compatibility exception requires accountable ownership',
);
assert.ok(
  Date.parse(exception.expires + 'T23:59:59Z') >= Date.now(),
  'Published SDK compatibility exception expired',
);
const gaps = [];
for (const name of Object.keys(metadata.sdkSignatures)) {
  const expected = parameterLists(await readFile(join(signatures, name), 'utf8'));
  const actual = parameterLists(
    await readFile(join(sdk, 'dist/generated/src/apis', name.replace('.ts', '.d.ts')), 'utf8'),
  );
  for (const [method, parameters] of Object.entries(expected)) {
    if (JSON.stringify(actual[method]) !== JSON.stringify(parameters))
      gaps.push({
        api: name.replace('.ts', ''),
        method,
        expectedParameters: parameters,
        publishedParameters: actual[method] ?? null,
      });
  }
}
assert.deepEqual(
  gaps,
  exception.findings,
  'Published SDK compatibility drift: review each operation instead of expanding an implicit exemption',
);
console.log(
  `Known SDK compatibility exception: ${gaps.length} exact parameter-list gaps, expires ${exception.expires}`,
);

/** Inventory every generated TypeScript file on disk, including ignored and untracked files. */
async function inventory(source) {
  const files = (await readdir(source)).filter((name) => name.endsWith('.generated.ts')).sort();
  const result = {};
  for (const file of files) result[file] = hash(await readFile(join(source, file)));
  return result;
}

const temporary = await mkdtemp(join(tmpdir(), '1msg-mcp-generation-'));
try {
  await mkdir(join(temporary, 'gen'), { recursive: true });
  await mkdir(join(temporary, 'public'), { recursive: true });
  await mkdir(join(temporary, 'packages/sdk/src/generated/src/apis'), { recursive: true });
  await mkdir(join(temporary, 'packages/mcp/src'), { recursive: true });
  await cp(producer, join(temporary, 'gen/generate-mcp-tools.cjs'));
  await cp(specPath, join(temporary, 'public/openapi.bundled.yaml'));
  await symlink(join(root, 'node_modules'), join(temporary, 'node_modules'), 'dir');
  for (const name of Object.keys(metadata.sdkSignatures)) {
    await cp(join(signatures, name), join(temporary, 'packages/sdk/src/generated/src/apis', name));
  }
  const execution = spawnSync(process.execPath, ['gen/generate-mcp-tools.cjs'], {
    cwd: temporary,
    encoding: 'utf8',
  });
  assert.equal(
    execution.status,
    0,
    `MCP producer failed: ${execution.stdout}\n${execution.stderr}`,
  );
  const generated = join(temporary, 'packages/mcp/src');
  const expected = await inventory(generated);
  assert.equal(Object.keys(expected).length, 2, 'MCP producer must emit both tools and handlers');
  const manifest = join(directory, 'inventory.json');
  if (process.argv.includes('--write')) {
    for (const file of Object.keys(await inventory(join(root, 'src')))) {
      if (!(file in expected)) await rm(join(root, 'src', file));
    }
    for (const file of Object.keys(expected))
      await cp(join(generated, file), join(root, 'src', file));
    await writeFile(manifest, JSON.stringify(expected, null, 2) + '\n');
  } else {
    for (const actual of [
      await inventory(join(root, 'src')),
      JSON.parse(await readFile(manifest, 'utf8')),
    ]) {
      assert.deepEqual(
        actual,
        expected,
        'Generated drift: review producer and run node quality/mcp/generate.mjs --write',
      );
    }
  }
  console.log('Verified real MCP generation from pinned producer, contract and SDK signatures');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
