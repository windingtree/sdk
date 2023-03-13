import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { createLibp2p, Libp2pOptions, Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { PeerId } from '@libp2p/interface-peer-id';
import { OPEN } from '@libp2p/interface-connection/status';
import { z, ZodType } from 'zod';
import { centerSub, CenterSub } from '../common/pubsub.js';
import { GenericQuery } from '../common/messages.js';
import { Request, RawRequest } from '../common/request.js';
import { RequestsRegistry } from './requestsRegistry.js';
import { decodeText } from '../utils/text.js';
import { StorageInitializer } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Client');

export const ClientOptionsSchema = z.object({
  serverAddress: z.string(),
});

export type ClientOptions = z.infer<typeof ClientOptionsSchema>;

export interface ClientEvents<CustomRequestQuery extends GenericQuery> {
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

  /**
   * @example
   *
   * ```js
   * request.addEventListener('requests', () => {
   *    // ... registry updated
   * })
   * ```
   */
  requests: CustomEvent<Required<Request<CustomRequestQuery>>[]>;
}

export class Client<CustomRequestQuery extends GenericQuery> extends EventEmitter<ClientEvents<CustomRequestQuery>> {
  libp2p?: Libp2p;
  options: ClientOptions;
  serverMultiaddr: Multiaddr;
  serverPeerId: PeerId;
  querySchema: z.ZodType<CustomRequestQuery>;
  private requestsRegistry?: RequestsRegistry<CustomRequestQuery>;
  private storageInitializer: StorageInitializer;

  constructor(
    options: ClientOptions,
    storageInitializer: StorageInitializer,
    querySchema: z.ZodType<CustomRequestQuery>,
  ) {
    super();
    this.options = ClientOptionsSchema.parse(options);
    this.serverMultiaddr = multiaddr(this.options.serverAddress);
    const serverPeerIdString = this.serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);

    if (!(querySchema instanceof ZodType)) {
      throw new Error('QuerySchema option of Request must be instance of ZodType');
    }

    this.querySchema = querySchema;
    this.storageInitializer = storageInitializer;
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

    this.libp2p.addEventListener('peer:connect', ({ detail }) => {
      try {
        if (detail.remotePeer.equals(this.serverPeerId)) {
          this.dispatchEvent(new CustomEvent<void>('connected'));
          logger.trace('🔗 Client connected to server at:', new Date().toISOString());
        }
      } catch (error) {
        logger.error(error);
      }
    });

    this.libp2p.addEventListener('peer:disconnect', ({ detail }) => {
      try {
        if (detail.remotePeer.equals(this.serverPeerId)) {
          this.dispatchEvent(new CustomEvent<void>('disconnected'));
          logger.trace('🔌 Client disconnected from server at:', new Date().toISOString());
        }
      } catch (error) {
        logger.error(error);
      }
    });

    this.libp2p.pubsub.addEventListener('message', ({ detail }) => {
      logger.trace(`Message: ${decodeText(detail.data)} on topic ${detail.topic}`);
    });

    this.requestsRegistry = new RequestsRegistry<CustomRequestQuery>(
      this,
      await this.storageInitializer<RawRequest<CustomRequestQuery>[]>(),
    );
    this.requestsRegistry.addEventListener('change', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<Required<Request<CustomRequestQuery>>[]>('requests', {
          detail,
        }),
      );
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

  async buildRequest(
    topic: string,
    expire: string | number,
    nonce: number,
    query: CustomRequestQuery,
  ): Promise<Request<CustomRequestQuery>> {
    if (!this.libp2p || !this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    const request = new Request({
      pubsub: this.libp2p.pubsub as CenterSub,
      querySchema: this.querySchema,
    });
    await request.build(topic, expire, nonce, query);
    this.requestsRegistry.set(request);

    return request;
  }

  _getRequests(): Required<Request<CustomRequestQuery>>[] {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.getAll();
  }

  _getRequest(id: string): Request<CustomRequestQuery> | undefined {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.get(id);
  }

  _deleteRequest(id: string): boolean {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.delete(id);
  }

  _clearRequests(): void {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.clear();
  }

  get requests() {
    return {
      get: this._getRequest.bind(this),
      getAll: this._getRequests.bind(this),
      delete: this._deleteRequest.bind(this),
      clear: this._clearRequests.bind(this),
    };
  }
}

export const createClient = <CustomRequestQuery extends GenericQuery>(
  options: ClientOptions,
  storageInit: StorageInitializer,
  querySchema: z.ZodType<CustomRequestQuery>,
): Client<CustomRequestQuery> => {
  return new Client(options, storageInit, querySchema);
};
