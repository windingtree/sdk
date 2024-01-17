import { defineConfig } from 'tsup';
import { dependencies } from './package.json';

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
      users: './src/users.ts',
      deals: './src/deals.ts',
    },
    platform: 'neutral',
    treeshake: true,
    dts: { resolve: true },
    sourcemap: true,
    splitting: false,
    clean: true,
    format: ['esm', 'cjs'],
    external: Object.keys(dependencies),
  },
]);
