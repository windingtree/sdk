import { defineConfig } from 'tsup';

const external = [
  '@trpc/server',
  '@trpc/client',
  'superjson',
  'viem',
  'zod',
  '@windingtree/sdk-types',
  '@windingtree/sdk-storage',
  '@windingtree/sdk-contracts-manager',
  '@windingtree/sdk-db',
  '@windingtree/sdk-messages',
  '@windingtree/sdk-logger',
  'node:http',
];

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
    external,
    clean: true,
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
    external,
    clean: true,
  },
]);
