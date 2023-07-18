import { defineConfig } from 'tsup';

const external = [
  'libp2p',
  '@libp2p/interfaces',
  '@chainsafe/libp2p-noise',
  '@libp2p/mplex',
  '@chainsafe/libp2p-yamux',
  '@libp2p/websockets',
  '@multiformats/multiaddr',
  '@libp2p/interface-connection',
  '@libp2p/interface-peer-id',
  '@libp2p/peer-id',
  'viem',
  '@windingtree/sdk-types',
  '@windingtree/sdk-pubsub',
  '@windingtree/sdk-utils',
  '@windingtree/sdk-contracts-manager',
  '@windingtree/sdk-messages',
  '@windingtree/sdk-logger',
];

export default defineConfig([
  {
    tsconfig: './tsconfig-build.json',
    entry: {
      index: './src/index.ts',
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
