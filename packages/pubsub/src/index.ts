import {
  GossipSub,
  GossipSubComponents,
  GossipsubEvents,
  GossipsubOpts,
} from '@chainsafe/libp2p-gossipsub';
import { ToSendGroupCount } from '@chainsafe/libp2p-gossipsub/metrics';
import { PeerIdStr, TopicStr } from '@chainsafe/libp2p-gossipsub/types';
import { PeerId } from '@libp2p/interface/peer-id';
import type { Direction } from '@libp2p/interface/connection';
import type { Message, PubSub } from '@libp2p/interface/pubsub';
import { RPC } from '@chainsafe/libp2p-gossipsub/message';
import { Multiaddr } from '@multiformats/multiaddr';
import { sha256 } from 'multiformats/hashes/sha2';
import { outboundStreamDelay } from '@windingtree/sdk-constants';
import { Storage } from '@windingtree/sdk-storage';
import { GenericMessage } from '@windingtree/sdk-types';
import { decodeText } from '@windingtree/sdk-utils';
import { CashedMessageEntry, MessagesCache } from './cache.js';
import { createLogger } from '@windingtree/sdk-logger';
import { parse } from 'superjson';

const logger = createLogger('CenterSub');

/**
 * Message transformer function type
 */
export type MessageTransformer = (message: ArrayBuffer) => GenericMessage;

/**
 * CenterSub initialization options type
 */
export interface CenterSubOptions {
  isClient?: boolean;
  directPeers?: GossipsubOpts['directPeers'];
  messageTransformer?: MessageTransformer;
  messagesStorage?: Storage;
}

/**
 * Message details interface
 */
export interface MessageDetails {
  detail: Message;
}

/**
 * CenterSub class. Centralized pubsub protocol for libp2p
 *
 * @export
 * @class CenterSub
 * @extends {GossipSub}
 */
export class CenterSub extends GossipSub {
  public readonly isClient: boolean;
  protected messages: MessagesCache | undefined;
  protected seenPeerMessageCache = new Map<string, Set<string>>();
  protected messageTransformer: MessageTransformer;
  /**
   * Creates an instance of CenterSub.
   *
   * @param {GossipSubComponents} components
   * @param {CenterSubOptions} options
   * @memberof CenterSub
   */
  constructor(components: GossipSubComponents, options: CenterSubOptions) {
    const { isClient, directPeers, messageTransformer, messagesStorage } =
      options;

    // @todo Validate CenterSub options

    const opts = {
      allowPublishToZeroPeers: true,
      directPeers: directPeers ?? [],
    };

    /**
     * A client node must be configured to be connected to the direct peers (servers)
     */
    if (isClient && opts.directPeers.length === 0) {
      throw new Error(
        'Address of the server must be provided with "directPeers" option',
      );
    }

    super(components, opts);

    if (!isClient && !messagesStorage) {
      throw new Error('Invalid messages storage');
    }

    if (!isClient && messagesStorage) {
      this.messages = new MessagesCache(messagesStorage);
    }

    /** Overriding private methods of GossipSub */
    this['selectPeersToPublish'] = this.onSelectPeersToPublish.bind(this);
    this['handleReceivedMessage'] = this.onHandleReceivedMessage.bind(this);
    this['addPeer'] = this.onAddPeer.bind(this);
    this['removePeer'] = this.onRemovePeer.bind(this);

    this.isClient = !!isClient;
    this.messageTransformer = messageTransformer
      ? messageTransformer
      : (message) => parse(decodeText(message));
    this.addEventListener(
      'gossipsub:heartbeat',
      this.handleHeartbeat.bind(this),
    );
  }

  /**
   * Publishes message to selected peer
   *
   * @private
   * @param {PeerId} peerId
   * @param {CashedMessageEntry[]} messages
   * @memberof CenterSub
   */
  private publishToPeer(peerId: PeerId, messages: CashedMessageEntry[]) {
    const id = peerId.toString();
    logger.trace('publishToPeer: peerId:', id);

    if (!this.peers.has(id)) {
      logger.trace('publishToPeer: peers.has(id):', false);
      return;
    }

    if (messages.length === 0) {
      logger.trace('publishToPeer: messages.length:', 0);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const sent = this['sendRpc'](id, {
      messages: messages.map((m) => m.data),
    }) as boolean;
    const sentMsgIds = messages.map((m) => {
      if (sent) {
        const peerCache =
          this.seenPeerMessageCache.get(id) || new Set<string>();
        this.seenPeerMessageCache.set(id, new Set([...peerCache, ...[m.id]]));
      }
    });
    logger.trace('publishToPeer: sendRpc:', sentMsgIds, sent);
  }

  /**
   * Protocol heartbeat callback
   *
   * @private
   * @memberof CenterSub
   */
  private handleHeartbeat() {
    if (!this.isClient && this.messages) {
      this.messages.prune().catch(logger.error);
    }
  }

  /**
   * Puts message to cache
   *
   * @private
   * @param {RPC.IMessage} rpcMsg
   * @returns {Promise<void>}
   * @memberof CenterSub
   */
  private async cacheMessage(rpcMsg: RPC.IMessage): Promise<void> {
    try {
      if (!this.messages) {
        logger.trace('Messages storage not initialized');
        return;
      }
      if (!rpcMsg.from || !rpcMsg.data) {
        logger.trace('Anonymous message');
        return;
      }
      if (!this.messageTransformer) {
        logger.trace('messageTransformer not defined');
        return;
      }
      const msgId = await sha256.encode(rpcMsg.data);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const msgIdStr = this['msgIdToStrFn'](msgId) as string;
      const transformed = this.messageTransformer(rpcMsg.data);
      await this.messages.set(
        msgIdStr,
        rpcMsg.from.toString(),
        rpcMsg,
        Number(transformed.expire),
        Number(transformed.nonce),
      );
    } catch (error) {
      logger.error(error);
    }
  }

  /**
   * Handles actions on every peer connection
   *
   * @private
   * @param {PeerId} peerId
   * @returns {void}
   * @memberof CenterSub
   */
  private async handlePeerConnect(peerId: PeerId): Promise<void> {
    try {
      if (!this.messages) {
        logger.trace('Messages storage not initialized');
        return;
      }
      const missedMessages = await this.messages.get();
      logger.trace(
        'handlePeerConnect: missedMessages.length:',
        missedMessages.length,
      );
      if (missedMessages.length > 0) {
        this.publishToPeer(peerId, missedMessages);
      }
    } catch (error) {
      logger.error(error);
    }
  }

  /**
   * Handles actions on adding peer to node peers registry
   *
   * @private
   * @param {PeerId} peerId
   * @param {Direction} direction
   * @param {Multiaddr} addr
   * @memberof CenterSub
   */
  private onAddPeer(
    peerId: PeerId,
    direction: Direction,
    addr: Multiaddr,
  ): void {
    const id = peerId.toString();
    const hasPeer = this.peers.has(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super['addPeer'](peerId, direction, addr);

    if (!hasPeer && direction === 'inbound') {
      // We need to wait for the outbound stream to be opened
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(() => this.handlePeerConnect(peerId), outboundStreamDelay);
    }
  }

  /**
   * Handles actions on peer removal
   *
   * @private
   * @param {CustomEvent<Connection>} { detail }
   * @memberof CenterSub
   */
  private onRemovePeer(peerId: PeerId): void {
    try {
      this.seenPeerMessageCache.delete(peerId.toString());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this['removePeer'](peerId);
    } catch (error) {
      logger.error(error);
    }
  }

  /**
   * Handles actions on received message
   *
   * @private
   * @param {PeerId} from
   * @param {RPC.IMessage} rpcMsg
   * @returns {Promise<void>}
   * @memberof CenterSub
   */
  private async onHandleReceivedMessage(
    from: PeerId,
    rpcMsg: RPC.IMessage,
  ): Promise<void> {
    // We subscribe a server to every incoming topic
    // to guarantee that every message will be processed.
    if (!this.isClient) {
      if (!(this['subscriptions'] as Set<TopicStr>).has(rpcMsg.topic)) {
        this.subscribe(rpcMsg.topic);
      }
      await this.cacheMessage(rpcMsg);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await super['handleReceivedMessage'](from, rpcMsg);
  }

  /**
   * Handles actions when selecting peers to publish message
   *
   * @private
   * @param {TopicStr} topic
   * @returns {{
   *     tosend: Set<PeerIdStr>;
   *     tosendCount: ToSendGroupCount;
   *   }}
   * @memberof CenterSub
   */
  private onSelectPeersToPublish(topic: TopicStr): {
    tosend: Set<PeerIdStr>;
    tosendCount: ToSendGroupCount;
  } {
    // If a pubsub is started on a client node
    // we always have to add direct peers to every topic subscribes list.
    // This hack will guarantee that the client will publish every message
    // through the directly connected nodes (even if they have not subscribed
    // on a topic before).
    if (this.isClient) {
      const peersInTopic: Set<string> =
        (this['topics'] as Map<TopicStr, Set<PeerIdStr>>).get(topic) ||
        new Set<string>();
      for (const peer of this.direct) {
        if (!peersInTopic.has(peer)) {
          peersInTopic.add(peer);
        }
      }
      (this['topics'] as Map<TopicStr, Set<PeerIdStr>>).set(
        topic,
        peersInTopic,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return super['selectPeersToPublish'](topic) as {
      tosend: Set<PeerIdStr>;
      tosendCount: ToSendGroupCount;
    };
  }
}

/**
 * Create CenterSub instance
 *
 * @param {CenterSubOptions} options
 * @returns {((components: GossipSubComponents) => PubSub<GossipsubEvents>)}
 */
export const centerSub = (
  options: CenterSubOptions,
): ((components: GossipSubComponents) => PubSub<GossipsubEvents>) => {
  return (components: GossipSubComponents) =>
    new CenterSub(components, options ?? {});
};
