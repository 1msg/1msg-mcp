import { maintainabilityConfig, tseslint } from './tools/quality/eslint.mjs';
export default [
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
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
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
  },
  ...maintainabilityConfig(),
];
