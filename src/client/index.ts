import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { createLibp2p, Libp2pOptions, Libp2p } from 'libp2p';
import { PublishResult } from '@libp2p/interface-pubsub';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { PeerId } from '@libp2p/interface-peer-id';
import { OPEN } from '@libp2p/interface-connection/status';
import { z } from 'zod';
import { centerSub, CenterSub } from '../common/pubsub.js';
import { decodeText, encodeText } from '../utils/text.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Client');

export const ClientOptionsSchema = z.object({
  serverAddress: z.string(),
});

export type ClientOptions = z.infer<typeof ClientOptionsSchema>;

export interface ClientEvents {
  /**
   * @example
   *
   * ```js
   * client.addEventListener('start', () => {
   *    // ... started
   * })
   * ```
   */
  start: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('stop', () => {
   *    // ... stopped
   * })
   * ```
   */
  stop: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('heartbeat', () => {
   *    // ... tick
   * })
   * ```
   */
  heartbeat: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('connected', () => {
   *    // ... connected
   * })
   * ```
   */
  connected: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('disconnected', () => {
   *    // ... disconnected
   * })
   * ```
   */
  disconnected: CustomEvent<void>;
}

export class Client extends EventEmitter<ClientEvents> {
  protected libp2p?: Libp2p;
  protected options: ClientOptions;
  protected serverMultiaddr: Multiaddr;
  protected serverPeerId: PeerId;

  constructor(options: ClientOptions) {
    super();
    this.options = ClientOptionsSchema.parse(options);
    this.serverMultiaddr = multiaddr(this.options.serverAddress);
    const serverPeerIdString = this.serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);
  }

  get connected(): boolean {
    return (
      !!this.libp2p &&
      (this.libp2p.pubsub as CenterSub).started &&
      this.libp2p.getPeers().length > 0 &&
      this.libp2p.getConnections(this.serverPeerId)[0]?.stat.status === OPEN
    );
  }

  async start(): Promise<void> {
    const config: Libp2pOptions = {
      transports: [webSockets({ filter: all })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      pubsub: centerSub({
        isClient: true,
        directPeers: [
          {
            id: this.serverPeerId,
            addrs: [this.serverMultiaddr],
          },
        ],
      }),
      ...this.options,
    };
    this.libp2p = await createLibp2p(config);

    (this.libp2p.pubsub as CenterSub).addEventListener('gossipsub:heartbeat', () => {
      this.dispatchEvent(new CustomEvent<void>('heartbeat'));
    });

    this.libp2p.addEventListener('peer:connect', async ({ detail }) => {
      if (detail.remotePeer.equals(this.serverPeerId)) {
        this.dispatchEvent(new CustomEvent<void>('connected'));
        logger.trace('🔗 Client connected to server at:', new Date().toISOString());
      }
    });

    this.libp2p.addEventListener('peer:disconnect', async ({ detail }) => {
      if (detail.remotePeer.equals(this.serverPeerId)) {
        this.dispatchEvent(new CustomEvent<void>('disconnected'));
        logger.trace('🔌 Client disconnected from server at:', new Date().toISOString());
      }
    });

    this.libp2p.pubsub.addEventListener('message', ({ detail }) => {
      logger.trace(`Message: ${decodeText(detail.data)} on topic ${detail.topic}`);
    });

    await this.libp2p.start();
    this.dispatchEvent(new CustomEvent<void>('start'));
    logger.trace('🚀 Client started at:', new Date().toISOString());
  }

  async stop(): Promise<void> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    await this.libp2p.stop();
    this.dispatchEvent(new CustomEvent<void>('stop'));
    logger.trace('👋 Client stopped at:', new Date().toISOString());
  }

  async publish(topic: string, message: string): Promise<PublishResult> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }
    return await this.libp2p.pubsub.publish(topic, encodeText(message));
  }
}

export const createClient = (options: ClientOptions): Client => {
  return new Client(options);
};
