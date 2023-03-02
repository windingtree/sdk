import { createLibp2p, Libp2pOptions, Libp2p } from 'libp2p';
import { createFromJSON } from '@libp2p/peer-id-factory';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { z } from 'zod';
import { centerSub, CenterSub } from '../common/pubsub.js';
import { decodeText } from '../utils/text.js';
import { CachedMessage } from '../common/cache.js';
import { Storage } from '../storage/index.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('Server');

export const NodeKeyJsonSchema = z
  .object({
    id: z.string(), // Peer Id
    privKey: z.string(), // Private key
    pubKey: z.string(), // Public key
  })
  .strict();

export type NodeKeyJson = z.infer<typeof NodeKeyJsonSchema>;

// Peer configuration options
export const PeerOptionsSchema = z
  .object({
    peerKey: NodeKeyJsonSchema.optional(), // Peer key
  })
  .strict();

export type PeerOptions = z.infer<typeof PeerOptionsSchema>;

// Server options
export const ServerOptionsSchema = PeerOptionsSchema.required()
  .extend({
    address: z.string().optional(), // Optional IP address of the server, defaults to '0.0.0.0'
    port: z.number(), // libp2p listening port
    messagesStorage: z.instanceof(Storage<CachedMessage>).optional(), // Messages storage
  })
  .strict();

export type ServerOptions = z.infer<typeof ServerOptionsSchema>;

export class CoordinationServer {
  public port: number;
  protected nodeKeyJson: NodeKeyJson;
  protected libp2p: Libp2p;
  protected options: ServerOptions;

  constructor(options: ServerOptions) {
    this.options = ServerOptionsSchema.parse(options);
    this.port = this.options.port;
    this.nodeKeyJson = this.options.peerKey;
  }

  get multiaddrs() {
    return this.libp2p.getMultiaddrs();
  }

  async start(): Promise<void> {
    const config: Libp2pOptions = {
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${this.port}/ws`],
      },
      transports: [webSockets({ filter: all })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      pubsub: centerSub({
        messagesStorage: this.options.messagesStorage,
        messageTransformer: <GenericMessage>(data: BufferSource) => {
          const dataString = decodeText(data);
          const dataObj = JSON.parse(dataString) as GenericMessage;
          return dataObj;
        },
      }),
    };
    const peerId = await createFromJSON(this.nodeKeyJson);
    this.libp2p = await createLibp2p({ peerId, ...config });

    this.libp2p.addEventListener('peer:discovery', async ({ detail }) => {
      const id = detail.id.toString();
      logger.trace('Peer discovery:', id);
    });

    this.libp2p.addEventListener('peer:connect', async ({ detail }) => {
      const id = detail.id.toString();
      logger.trace('Peer connected:', id);
    });

    this.libp2p.addEventListener('peer:disconnect', async ({ detail }) => {
      const id = detail.id.toString();
      logger.trace('Peer disconnected:', id);
    });

    (this.libp2p.pubsub as CenterSub).addEventListener('message', ({ detail }) => {
      logger.trace(`Message: ${decodeText(detail.data)} on topic ${detail.topic}`);
    });

    await this.libp2p.start();
    logger.trace('🚀 Started at:', new Date().toISOString());
    logger.trace('Listened for peers at:', this.multiaddrs);
  }

  async stop(): Promise<void> {
    await this.libp2p.stop();
  }
}
