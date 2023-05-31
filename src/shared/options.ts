import { Libp2pInit } from 'libp2p';
import { Hash, Hex } from 'viem';
import { ProtocolChain } from '../utils/contracts.js';
import { StorageInitializer } from '../storage/abstract.js';

export type NoncePeriodOption = {
  /** Period while the node waits and accepting requests with the same Id */
  noncePeriod: number;
};

export type ChainsConfigOption = {
  /** The protocol chains configuration */
  chain: ProtocolChain;
};

export type ServerAddressOption = {
  /** Multiaddr of the coordination server */
  serverAddress: string;
};

export type SignerSeedOptions = {
  /** Seed phrase of the node signer wallet */
  signerSeedPhrase?: string;
  /** Viem HDAccount */
  signerPk?: Hex;
};

/**
 * The protocol node initialization options type
 */
export interface NodeOptions
  extends NoncePeriodOption,
    ChainsConfigOption,
    ServerAddressOption,
    SignerSeedOptions {
  /** libp2p configuration options */
  libp2p?: Libp2pInit;
  /** Subscription topics of node */
  topics: string[];
  /** Unique supplier Id */
  supplierId: Hash;
}

/**
 * Request manager (of the protocol node) initialization options type
 */
export type RequestManagerOptions = NoncePeriodOption;

/**
 * The protocol client initialization schema type
 */
export interface ClientOptions extends ChainsConfigOption, ServerAddressOption {
  /** libp2p configuration options */
  libp2p?: Libp2pInit;
  /** Storage initializer function */
  storageInitializer: StorageInitializer;
  /** DB keys prefix */
  dbKeysPrefix: string;
}

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
