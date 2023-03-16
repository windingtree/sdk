import { createLibp2p, Libp2pOptions, Libp2p } from 'libp2p';
import { createFromJSON } from '@libp2p/peer-id-factory';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { NodeKeyJson, ServerOptions, ServerOptionsSchema } from '../shared/options.js';
import { centerSub, CenterSub } from '../shared/pubsub.js';
import { decodeText } from '../utils/text.js';
import { Storage, StorageInitializer } from '../storage/abstract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Server');

export interface CoordinationServerEvents {
  /**
   * @example
   *
   * ```js
   * server.addEventListener('start', () => {
   *    // ... started
   * })
   * ```
   */
  start: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * server.addEventListener('stop', () => {
   *    // ... stopped
   * })
   * ```
   */
  stop: CustomEvent<void>;
}

export class CoordinationServer extends EventEmitter<CoordinationServerEvents> {
  public port: number;
  private peerKey: NodeKeyJson;
  private libp2p?: Libp2p;
  private options: ServerOptions;
  private messagesStorageInit?: StorageInitializer;

  constructor(options: ServerOptions, messagesStorageInit?: StorageInitializer) {
    super();
    this.options = ServerOptionsSchema.parse(options);
    this.messagesStorageInit = messagesStorageInit;
    this.port = this.options.port;
    this.peerKey = this.options.peerKey;
  }

  get multiaddrs() {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    return this.libp2p.getMultiaddrs();
  }

  async start(): Promise<void> {
    let messagesStorage: Storage | undefined;

    if (this.messagesStorageInit) {
      messagesStorage = await this.messagesStorageInit();
    }

    const config: Libp2pOptions = {
      start: false,
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${this.port}/ws`],
      },
      transports: [webSockets({ filter: all })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      pubsub: centerSub({}, messagesStorage),
    };
    const peerId = await createFromJSON(this.peerKey);
    this.libp2p = await createLibp2p({ peerId, ...config });

    (this.libp2p.pubsub as CenterSub).addEventListener('message', ({ detail }) => {
      logger.trace(`Message: ${decodeText(detail.data)} on topic ${detail.topic}`);
    });

    await this.libp2p.start();
    this.dispatchEvent(new CustomEvent<void>('start'));
    logger.trace('🚀 Server started at:', new Date().toISOString());
    logger.trace('Listened for peers at:', this.multiaddrs);
  }

  async stop(): Promise<void> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    await this.libp2p.stop();
    this.dispatchEvent(new CustomEvent<void>('stop'));
    logger.trace('👋 Server stopped at:', new Date().toISOString());
  }
}

export const createServer = (
  options: ServerOptions,
  messagesStorageInit?: StorageInitializer,
): CoordinationServer => {
  return new CoordinationServer(options, messagesStorageInit);
};
