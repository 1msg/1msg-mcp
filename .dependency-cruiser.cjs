// Owners and constraints for this repository's actual runtime roots.
module.exports = {
  forbidden: [
    {
      name: 'no-runtime-cycles',
      severity: 'error',
      from: {},
      to: {
        circular: true,
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'no-unresolved-dependencies',
      severity: 'error',
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: 'no-runtime-test-dependencies',
      severity: 'error',
      from: {
        path: '^(?:src)/',
        pathNot: '(?:__tests__|test|tests)/|\\.(?:test|spec)\\.',
      },
      to: {
        path: '(?:^|/)(?:__tests__|tests|test)/|(?:^|node_modules/)(?:jest|vitest|ts-jest)',
      },
    },
    {
      name: 'no-sdk-in-pure-transforms',
      severity: 'error',
      from: {
        path: '^src/(?:auth|json-schema-to-zod|logging|rate-limit)\\.ts$',
      },
      to: {
        path: 'node_modules/(?:@1msg|express|@modelcontextprotocol)/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.quality.json',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['require', 'node', 'default'],
      extensions: ['.js', '.ts', '.json'],
    },
    exclude: '(?:^|/)node_modules/',
  },
};
