export default {
  schemaVersion: 1,
  profile: 'A',
  defaultBranch: 'main',
  sourceRoots: [
    'src',
    'quality/mcp',
    'scripts',
    'jest.config.js',
    'eslint.config.mjs',
    'eslint.typed.config.mjs',
    'eslint.complexity.config.mjs',
    '.dependency-cruiser.cjs',
    'quality.config.mjs',
  ],
  generated: [
    {
      pattern: 'quality/mcp/vendor/**',
      producer:
        'Pinned 1msg-api gen/generate-mcp-tools.js; checksum verified by quality/mcp/generate.mjs',
    },
    {
      pattern: 'src/tools.generated.ts',
      producer: 'node quality/mcp/generate.mjs --write',
    },
    {
      pattern: 'src/handlers.generated.ts',
      producer: 'node quality/mcp/generate.mjs --write',
    },
  ],
  comments: {
    full: ['scripts/pack-smoke.mjs', 'scripts/quality-negative.mjs'],
  },
  knipConfig: 'knip.json',
  duplicatePaths: ['src', 'scripts'],
  duplicateIgnore: [
    'src/tools.generated.ts',
    'src/handlers.generated.ts',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
  ],
  baselineDir: 'quality/baselines',
  duplicateMaxPercentage: 5,
  duplicateFullPaths: ['src', 'scripts'],
  duplicateFullIgnore: ['src/tools.generated.ts', 'src/handlers.generated.ts'],
};
