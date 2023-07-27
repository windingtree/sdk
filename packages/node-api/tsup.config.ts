import { defineConfig } from 'tsup';
import { dependencies } from './package.json';

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      client: './src/client.ts',
    },
    platform: 'browser',
    treeshake: true,
    dts: true,
    sourcemap: true,
    format: ['esm', 'cjs'],
    external: Object.keys(dependencies),
    splitting: false,
  },
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
      router: './src/router/index.ts',
      server: './src/server.ts',
    },
    platform: 'node',
    treeshake: true,
    dts: true,
    sourcemap: true,
    format: ['esm', 'cjs'],
    external: Object.keys(dependencies),
    splitting: false,
  },
]);
