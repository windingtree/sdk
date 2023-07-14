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
      entry: [resolve(__dirname, 'src/index.ts')],
      name: 'queue',
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format}.js`,
    },
    rollupOptions: {
      external: [
        '@chainsafe/libp2p-gossipsub',
        '@libp2p/interface-pubsub',
        '@libp2p/interface-peer-id',
        '@libp2p/interface-connection',
        '@multiformats/multiaddr',
        'multiformats',
        '@windingtree/sdk-constants',
        '@windingtree/sdk-storage',
        '@windingtree/sdk-types',
        '@windingtree/sdk-utils',
        '@windingtree/sdk-logger',
      ],
    },
  },
});
