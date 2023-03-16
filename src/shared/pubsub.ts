import {
  GossipSub,
  GossipSubComponents,
  GossipsubEvents,
  GossipsubOpts,
} from '@chainsafe/libp2p-gossipsub';
import { ToSendGroupCount } from '@chainsafe/libp2p-gossipsub/metrics';
import { PeerIdStr, TopicStr } from '@chainsafe/libp2p-gossipsub/types';
import { PubSub, Message } from '@libp2p/interface-pubsub';
import { PeerId } from '@libp2p/interface-peer-id';
import type { Connection, Direction } from '@libp2p/interface-connection';
import { RPC } from '@chainsafe/libp2p-gossipsub/message';
import { Multiaddr } from '@multiformats/multiaddr';
import { sha256 } from 'multiformats/hashes/sha2';
import { z } from 'zod';
import { outboundStreamDelay } from '../constants.js';
import { Storage } from '../storage/abstract.js';
import { GenericMessageSchema, GenericMessage } from '../shared/messages.js';
import { decodeText } from '../utils/text.js';
import { CachedMessage, CashedMessageEntry, MessagesCache } from './cache.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PubSub');

export const MessageTransformerSchema = z
  .function()
  .args(z.instanceof(ArrayBuffer))
  .returns(GenericMessageSchema);

export type MessageTransformer = z.infer<typeof MessageTransformerSchema>;

export const CenterSubOptionsSchema = z.object({
  isClient: z.boolean().optional(),
  directPeers: z
    .array(
      z.object({
        id: z.any().nullable(),
        addrs: z.any(),
      }),
    )
    .optional(),
  messageTransformer: MessageTransformerSchema.optional(),
});

export type CenterSubOptions = z.infer<typeof CenterSubOptionsSchema>;

export interface MessageDetails {
  detail: Message;
}

export class CenterSub extends GossipSub {
  public readonly isClient: boolean;
  protected messages: MessagesCache | undefined;
  protected seenPeerMessageCache = new Map<string, Set<string>>();
  protected messageTransformer: MessageTransformer;
  protected options: CenterSubOptions;

  constructor(
    components: GossipSubComponents,
    options: CenterSubOptions,
    messagesStorage?: Storage<CachedMessage>,
  ) {
    options = CenterSubOptionsSchema.parse(options);

    const opts = {
      allowPublishToZeroPeers: true,
      directPeers: (options.directPeers as unknown as GossipsubOpts['directPeers']) ?? [],
    };

    // A client node must be configured to be connected to the direct peers (servers)
    if (options.isClient && opts.directPeers.length === 0) {
      throw new Error('Address of the server must be provided with "directPeers" option');
    }

    super(components, opts);
    this.options = options;

    if (!this.options.isClient && !messagesStorage) {
      throw new Error('Invalid messages storage');
    }

    if (!this.options.isClient && messagesStorage) {
      this.messages = new MessagesCache(messagesStorage);
    }

    this['selectPeersToPublish'] = this.onSelectPeersToPublish.bind(this);
    this['handleReceivedMessage'] = this.onHandleReceivedMessage.bind(this);
    this['addPeer'] = this.onAddPeer.bind(this);

    this.isClient = !!this.options.isClient;
    this.messageTransformer = this.options.messageTransformer
      ? this.options.messageTransformer
      : (message) => JSON.parse(decodeText(message)) as GenericMessage;
    this.addEventListener('gossipsub:heartbeat', this.handleHeartbeat.bind(this));
    components.connectionManager.addEventListener(
      'peer:disconnect',
      this.handlePeerDisconnect.bind(this),
    );
  }

  private publishToPeer(peerId: PeerId, messages: CashedMessageEntry[]): void {
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
    const sent = this['sendRpc'](id, { messages: messages.map((m) => m.data) }) as boolean;
    const sentMsgIds = messages.map((m) => {
      if (sent) {
        const peerCache = this.seenPeerMessageCache.get(id) || new Set<string>();
        this.seenPeerMessageCache.set(id, new Set([...peerCache, ...[m.id]]));
      }
    });
    logger.trace('publishToPeer: sendRpc:', sentMsgIds, sent);
  }

  private handleHeartbeat(): void {
    if (!this.isClient && this.messages) {
      this.messages.prune().catch(logger.error);
    }
  }

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
        transformed.expire,
        transformed.nonce,
      );
    } catch (error) {
      logger.error(error);
    }
  }

  private handlePeerConnect(peerId: PeerId): void {
    try {
      if (!this.messages) {
        logger.trace('Messages storage not initialized');
        return;
      }
      const missedMessages = this.messages.get();
      logger.trace('handlePeerConnect: missedMessages.length:', missedMessages.length);
      if (missedMessages.length > 0) {
        this.publishToPeer(peerId, missedMessages);
      }
    } catch (error) {
      logger.error(error);
    }
  }

  private onAddPeer(peerId: PeerId, direction: Direction, addr: Multiaddr): void {
    const id = peerId.toString();
    const hasPeer = this.peers.has(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super['addPeer'](peerId, direction, addr);
    if (!hasPeer && direction === 'inbound') {
      // We need to wait for the outbound stream to be opened
      setTimeout(() => this.handlePeerConnect(peerId), outboundStreamDelay);
    }
  }

  private handlePeerDisconnect({ detail }: CustomEvent<Connection>): void {
    try {
      const id = detail.id.toString();
      this.seenPeerMessageCache.delete(id);
    } catch (error) {
      logger.error(error);
    }
  }

  private async onHandleReceivedMessage(from: PeerId, rpcMsg: RPC.IMessage): Promise<void> {
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
        (this['topics'] as Map<TopicStr, Set<PeerIdStr>>).get(topic) || new Set<string>();
      for (const peer of this.direct) {
        if (!peersInTopic.has(peer)) {
          peersInTopic.add(peer);
        }
      }
      (this['topics'] as Map<TopicStr, Set<PeerIdStr>>).set(topic, peersInTopic);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return super['selectPeersToPublish'](topic) as {
      tosend: Set<PeerIdStr>;
      tosendCount: ToSendGroupCount;
    };
  }
}

export const centerSub = (
  options: CenterSubOptions,
  messagesStorage?: Storage<CachedMessage>,
): ((components: GossipSubComponents) => PubSub<GossipsubEvents>) => {
  return (components: GossipSubComponents) =>
    new CenterSub(components, options ?? {}, messagesStorage);
};
