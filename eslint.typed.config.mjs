import { typedConfig } from './tools/quality/eslint.mjs';
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tools/quality/**',
      '**/quality/reports/**',
      'src/tools.generated.ts',
      'src/handlers.generated.ts',
    ],
  },
  ...typedConfig({ project: './tsconfig.quality.json', tsconfigRootDir: import.meta.dirname }),
];
