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
      name: 'db',
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        users: resolve(__dirname, 'src/users.ts'),
        deals: resolve(__dirname, 'src/deals.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: [
        'viem',
        'zod',
        'bcrypt-ts',
        '@windingtree/sdk-types',
        '@windingtree/sdk-storage',
        '@windingtree/sdk-logger',
      ],
    },
  },
});
