import { staticConfig, globals } from './tools/quality/eslint.mjs';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tools/quality/**',
      'quality/mcp/vendor/**',
      '**/quality/reports/**',
      'src/tools.generated.ts',
      'src/handlers.generated.ts',
    ],
  },
  ...staticConfig({ globals: { ...globals.node, ...globals.jest } }),
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.quality.json',
          conditionNames: ['require', 'node', 'default'],
        },
        node: { extensions: ['.js', '.json', '.ts', '.mjs', '.cjs'] },
      },
    },
  },
];
