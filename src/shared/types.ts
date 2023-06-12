import { Address, Hash } from 'viem';
import { DealStatus } from './contracts.js';

/**
 * Generic message data type
 */
export interface GenericMessage {
  /** Unique message Id */
  id: Hash;
  /** Expiration time in seconds */
  expire: bigint;
  /** A number that reflects the version of the message */
  nonce: bigint;
}

/**
 * Generic query type
 */
export type GenericQuery = Record<string, unknown>;

/**
 * Request data type
 */
export interface RequestData<
  CustomRequestQuery extends GenericQuery = GenericQuery,
> extends GenericMessage {
  /** Request topic */
  topic: string;

  /** Custom query validation schema */
  query: CustomRequestQuery;
}

/**
 * buildRequest method options type
 */
export interface BuildRequestOptions<
  CustomRequestQuery extends GenericQuery = GenericQuery,
> {
  /** Expiration time */
  expire: string | bigint;
  /** Nonce */
  nonce: bigint;
  /** Topic */
  topic: string;
  /** Request query */
  query: CustomRequestQuery;
  /** If allowed request Id override */
  idOverride?: Hash;
}

/**
 * Offered payment option type
 */
export interface PaymentOption {
  /** Unique payment option Id */
  id: Hash;
  /** Asset price in WEI */
  price: bigint;
  /** ERC20 asset contract address */
  asset: Address;
}

/**
 * Offered cancellation option type
 */
export interface CancelOption {
  /** Seconds before checkIn */
  time: bigint;
  /** Percents of total sum */
  penalty: bigint;
}

/**
 * Unsigned offer payload type
 */
export interface UnsignedOfferPayload extends Record<string, unknown> {
  /** Unique Offer Id */
  id: Hash;
  /** Expiration time */
  expire: bigint;
  /** Unique supplier Id registered on the protocol contract */
  supplierId: Hash;
  /** Target network chain Id */
  chainId: bigint;
  /** <keccak256(request.hash())> */
  requestHash: Hash;
  /** <keccak256(hash(offer.options))> */
  optionsHash: Hash;
  /** <keccak256(hash(offer.payment))> */
  paymentHash: Hash;
  /** <keccak256(hash(offer.cancel || []))> */
  cancelHash: Hash;
  /** makes the deal NFT transferable or not */
  transferable: boolean;
  /** check-in time in seconds */
  checkIn: bigint;
  /** check-out time in seconds */
  checkOut: bigint;
}

/**
 * Generic offer is just an object with props type
 */
export type GenericOfferOptions = Record<string, unknown>;

/**
 * Offer data type
 */
export interface OfferData<
  CustomRequestQuery extends GenericQuery = GenericQuery,
  CustomOfferOptions extends GenericOfferOptions = GenericOfferOptions,
> extends GenericMessage {
  /** Copy of request */
  request: RequestData<CustomRequestQuery>;
  /** Offer options */
  options: CustomOfferOptions;
  /** Payment options */
  payment: PaymentOption[];
  /** Cancellation options */
  cancel: CancelOption[];
  /** Raw offer payload */
  payload: UnsignedOfferPayload;
  //** EIP-712 TypedSignature(UnsignedOffer) */
  signature: Hash;
}

/**
 * Smart contract configuration type
 */
export interface ContractConfig {
  /** Smart contract name */
  name: string;
  /** Internal smart contract version */
  version: string;
  /** Smart contract address */
  address: Address;
}

/**
 * The protocol smart contract set configuration
 */
export interface Contracts {
  /** The protocol configuration smart contract */
  config: ContractConfig;
  /** The protocol entities registry smart contract */
  entities: ContractConfig;
  /** The protocol market smart contract */
  market: ContractConfig;
  /** The protocol utility token */
  token: ContractConfig;
}

/**
 * Deal data type
 */
export interface DealData {
  /** NFT Id */
  tokenId: number;
  /** Supplier Id */
  supplierId: Hash;
  /** Deal status */
  status: DealStatus;
  /** Deal status change reason */
  reason?: string;
  /** Deal creation date */
  created: string;
  /** Deal update date */
  updated: string;
}
