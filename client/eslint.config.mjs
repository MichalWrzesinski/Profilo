import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  { ignores: ['.next/**', 'coverage/**', 'next-env.d.ts', 'src/lib/api/schema.d.ts'] },
];

export default config;
