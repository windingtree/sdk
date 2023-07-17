import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      tsconfigPath: './tsconfig-build.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        server: resolve(__dirname, 'src/server.ts'),
        client: resolve(__dirname, 'src/client.ts'),
      },
      name: 'db',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: [
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
      ],
    },
  },
});
