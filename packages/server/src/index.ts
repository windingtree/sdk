import { createLibp2p, Libp2p, Libp2pOptions } from 'libp2p';
import { createFromJSON } from '@libp2p/peer-id-factory';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { yamux } from '@chainsafe/libp2p-yamux';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { CustomEvent, EventEmitter } from '@libp2p/interface/events';
import { NodeKeyJson, PeerOptions } from '@windingtree/sdk-types';
import { centerSub, CenterSub } from '@windingtree/sdk-pubsub';
import { decodeText } from '@windingtree/sdk-utils';
import { Storage, StorageInitializer } from '@windingtree/sdk-storage';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('Server');

/**
 * The protocol coordination server options type
 */
export interface ServerOptions extends Required<PeerOptions> {
  /** Optional IP address of the server, defaults to '0.0.0.0' */
  address?: string;
  /** Server port */
  port: number;
  /** Messages storage initializer */
  messagesStorageInit: StorageInitializer;
}

/**
 * Coordination server events interface
 */
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

/**
 * Coordination server class
 *
 * @class CoordinationServer
 * @extends {EventEmitter<CoordinationServerEvents>}
 */
export class CoordinationServer extends EventEmitter<CoordinationServerEvents> {
  public port: number;
  /** Peer key in Json format */
  private peerKey: NodeKeyJson;
  private libp2p?: Libp2p;
  private messagesStorageInit: StorageInitializer;
  private messagesStorage?: Storage;

  /**
   * Creates an instance of CoordinationServer.
   *
   * @param {ServerOptions} options
   * @memberof CoordinationServer
   */
  constructor(options: ServerOptions) {
    super();
    const { port, peerKey, messagesStorageInit } = options;

    // @todo Validate ServerOptions

    this.messagesStorageInit = messagesStorageInit;
    this.port = port;
    this.peerKey = peerKey;
  }

  /**
   * Represents multiaddrs set of the server
   *
   * @readonly
   * @memberof CoordinationServer
   */
  get multiaddrs(): ReturnType<Libp2p['getMultiaddrs']> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    return this.libp2p.getMultiaddrs();
  }

  /**
   * Starts the coordination server
   *
   * @returns {Promise<void>}
   * @memberof CoordinationServer
   */
  async start(): Promise<void> {
    this.messagesStorage = await this.messagesStorageInit();
    await this.messagesStorage.open();

    const config: Libp2pOptions = {
      start: false,
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${this.port}/ws`],
      },
      transports: [webSockets({ filter: all })],
      streamMuxers: [yamux(), mplex()],
      connectionEncryption: [noise()],
      services: {
        pubsub: centerSub({
          messagesStorage: this.messagesStorage,
        }),
      },
      connectionManager: {
        maxPeerAddrsToDial: 10,
        minConnections: 0,
        maxConnections: 10000,
        maxParallelDials: 20,
      },
    };

    const peerId = await createFromJSON(this.peerKey);
    this.libp2p = await createLibp2p({ peerId, ...config });

    (this.libp2p.services.pubsub as CenterSub).addEventListener(
      'message',
      ({ detail }) => {
        logger.trace(
          `Message: ${decodeText(detail.data)} on topic ${detail.topic}`,
        );
      },
    );

    await this.libp2p.start();
    this.dispatchEvent(new CustomEvent<void>('start'));
    logger.trace('🚀 Server started at:', new Date().toISOString());
    logger.trace('Listened for peers at:', this.multiaddrs);
  }

  /**
   * Stops the coordination server
   *
   * @returns {Promise<void>}
   * @memberof CoordinationServer
   */
  async stop(): Promise<void> {
    await this.messagesStorage?.close();
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    await this.libp2p.stop();
    this.dispatchEvent(new CustomEvent<void>('stop'));
    logger.trace('👋 Server stopped at:', new Date().toISOString());
  }
}

/**
 * Create an instance of the coordination server
 *
 * @param {ServerOptions} options
 * @returns {CoordinationServer}
 */
export const createServer = (options: ServerOptions): CoordinationServer => {
  return new CoordinationServer(options);
};
