import { Chain } from 'viem';
import { StorageInitializer } from '../storage/abstract.js';
import { Contracts } from './types.js';

export type NoncePeriodOption = {
  /** Period while the node waits and accepting requests with the same Id */
  noncePeriod: number;
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
