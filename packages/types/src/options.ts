import type { Chain } from 'viem';
import type { Contracts } from './index.js';

export type NoncePeriodOption = {
  /** Period while the node waits and accepting requests with the same Id */
  noncePeriod: number | string;
};

export type ChainsConfigOption = {
  /** The protocol chains configuration */
  chain: Chain;
  contracts: Contracts;
};

export type ServerAddressOption = {
  /** Multiaddr of the coordination server */
  serverAddress: string;
};

/**
 * Interface of a node key in Json format (type)
 */
export interface NodeKeyJson {
  /** Peer Id */
  id: string;
  /** Private key */
  privKey: string;
  /** Public key */
  pubKey: string;
}

/**
 * Peer configuration options type
 */
export interface PeerOptions {
  /** Peer key */
  peerKey?: NodeKeyJson;
}
