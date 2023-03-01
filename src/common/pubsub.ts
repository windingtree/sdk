import { GossipSub, GossipSubComponents, GossipsubEvents, GossipsubOpts } from '@chainsafe/libp2p-gossipsub';
import { ToSendGroupCount } from '@chainsafe/libp2p-gossipsub/metrics';
import { PeerIdStr, TopicStr } from '@chainsafe/libp2p-gossipsub/types';
import { PubSub, Message } from '@libp2p/interface-pubsub';
import { PeerId } from '@libp2p/interface-peer-id';
import { RPC } from '@chainsafe/libp2p-gossipsub/message';
import { Multiaddr } from '@multiformats/multiaddr';
import { sha256 } from 'multiformats/hashes/sha2';
import { outboundStreamDelay } from '../constants.js';
import { GenericMessage } from '../utils/messages.js';
import { CashedMessageEntry, MessagesCache } from './cache.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('PubSub');

export type ConnectionDirection = 'inbound' | 'outbound';

export type MessageTransformer = <T extends GenericMessage>(data: BufferSource) => T;

export interface CenterSubOptions {
  isClient: boolean;
  directPeers: GossipsubOpts['directPeers'];
  messageTransformer: MessageTransformer;
}

export interface MessageDetails {
  detail: Message;
}

export class CenterSub extends GossipSub {
  public readonly isClient: boolean;
  private messages = new MessagesCache();
  private seenPeerMessageCache = new Map<string, Set<string>>();
  private messageTransformer?: MessageTransformer;

  constructor(components: GossipSubComponents, options: Partial<CenterSubOptions> = {}) {
    const opts = {
      allowPublishToZeroPeers: true,
      directPeers: options?.directPeers || [],
    };
    // A client node must be configured to be connected to the direct peers (servers)
    if (options.isClient && opts.directPeers.length === 0) {
      throw new Error('Address of the server must be provided with "directPeers" option');
    }

    super(components, opts);
    this['selectPeersToPublish'] = this.onSelectPeersToPublish;
    this['handleReceivedMessage'] = this.onHandleReceivedMessage;
    this['addPeer'] = this.onAddPeer;

    this.isClient = !!options.isClient;
    this.messageTransformer = options.messageTransformer;
    this.addEventListener('gossipsub:heartbeat', this.handleHeartbeat.bind(this));
    components.connectionManager.addEventListener('peer:disconnect', this.handlePeerDisconnect.bind(this));
  }

  private async publishToPeer(peerId: PeerId, messages: CashedMessageEntry[]): Promise<void> {
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

    const sent = this['sendRpc'](id, { messages: messages.map((m) => m.data) });
    const sentMsgIds = messages.map((m) => {
      if (sent) {
        const peerCache = this.seenPeerMessageCache.get(id) || new Set<string>();
        this.seenPeerMessageCache.set(id, new Set([...peerCache, ...[m.id]]));
      }
    });
    logger.trace('publishToPeer: sendRpc:', sentMsgIds, sent);
  }

  private handleHeartbeat(): void {
    try {
      if (!this.isClient) {
        this.messages.prune();
      }
    } catch (error) {
      logger.error(error);
    }
  }

  private async cacheMessage(rpcMsg: RPC.IMessage): Promise<void> {
    try {
      if (!rpcMsg.from || !rpcMsg.data) {
        logger.trace('Anonymous message');
        return;
      }
      if (!this.messageTransformer) {
        logger.trace('messageTransformer not defined');
        return;
      }
      const msgId = await sha256.encode(rpcMsg.data);
      const msgIdStr = this['msgIdToStrFn'](msgId) as string;
      const transformed = this.messageTransformer<GenericMessage>(rpcMsg.data);
      this.messages.set(msgIdStr, rpcMsg.from.toString(), rpcMsg, transformed.expire, transformed.nonce);
    } catch (error) {
      logger.error(error);
    }
  }

  private async handlePeerConnect(peerId: PeerId): Promise<void> {
    try {
      const missedMessages = this.messages.get();
      logger.trace('handlePeerConnect: missedMessages.length:', missedMessages.length);
      if (missedMessages.length > 0) {
        await this.publishToPeer(peerId, missedMessages);
      }
    } catch (error) {
      logger.error(error);
    }
  }

  private onAddPeer(peerId: PeerId, direction: ConnectionDirection, addr: Multiaddr): void {
    const id = peerId.toString();
    const hasPeer = this.peers.has(id);
    super['addPeer'](peerId, direction, addr);
    if (!hasPeer && direction === 'inbound') {
      // We need to wait for the outbound stream to be opened
      setTimeout(() => this.handlePeerConnect(peerId), outboundStreamDelay);
    }
  }

  private async handlePeerDisconnect({ detail }): Promise<void> {
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
      if (!this['subscriptions'].has(rpcMsg.topic)) {
        this.subscribe(rpcMsg.topic);
      }
      await this.cacheMessage(rpcMsg);
    }
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
      const peersInTopic: Set<string> = this['topics'].get(topic) || new Set<string>();
      for (const peer of this.direct) {
        if (!peersInTopic.has(peer)) {
          peersInTopic.add(peer);
        }
      }
      this['topics'].set(topic, peersInTopic);
    }
    return super['selectPeersToPublish'](topic);
  }
}

export function centerSub(
  options?: Partial<CenterSubOptions>,
): (components: GossipSubComponents) => PubSub<GossipsubEvents> {
  return (components: GossipSubComponents) => new CenterSub(components, options);
}
