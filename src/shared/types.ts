import { BigNumberish } from 'ethers';

/**
 * Generic message data type
 */
export interface GenericMessage {
  /** Unique message Id */
  id: string;
  /** Expiration time in seconds */
  expire: BigNumberish;
  /** A number that reflects the version of the message */
  nonce: BigNumberish;
}

/**
 * Generic query type
 */
export type GenericQuery = Record<string, unknown>;

/**
 * Request data type
 */
export interface RequestData<CustomRequestQuery extends GenericQuery> extends GenericMessage {
  /** Request topic */
  topic: string;

  /** Custom query validation schema */
  query: CustomRequestQuery;
}

/**
 * buildRequest method options type
 */
export interface BuildRequestOptions<CustomRequestQuery extends GenericQuery> {
  /** Expiration time */
  expire: string | BigNumberish;
  /** Nonce */
  nonce: BigNumberish;
  /** Topic */
  topic: string;
  /** Request query */
  query: CustomRequestQuery;
  /** If allowed request Id override */
  idOverride?: string;
}

/**
 * Offered payment option type
 */
export interface PaymentOption {
  /** Unique payment option Id */
  id: string;
  /** Asset price in WEI */
  price: BigNumberish;
  /** ERC20 asset contract address */
  asset: string;
}

/**
 * Offered cancellation option type
 */
export interface CancelOption {
  /** Seconds before checkIn */
  time: BigNumberish;
  /** Percents of total sum */
  penalty: BigNumberish;
}

/**
 * Unsigned offer payload type
 */
export interface UnsignedOfferPayload {
  /** Unique Offer Id */
  id: string;
  /** Expiration time */
  expire: BigNumberish;
  /** Unique supplier Id registered on the protocol contract */
  supplierId: string;
  /** Target network chain Id */
  chainId: BigNumberish;
  /** <keccak256(request.hash())> */
  requestHash: string;
  /** <keccak256(JSON.stringify(offer.options))> */
  optionsHash: string;
  /** <keccak256(JSON.stringify(offer.payment))> */
  paymentHash: string;
  /** <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))> */
  cancelHash: string;
  /** makes the deal NFT transferable or not */
  transferable: boolean;
  /** check-in time in seconds */
  checkIn: BigNumberish;
  /** check-out time in seconds */
  checkOut: BigNumberish;
}

/**
 * Generic offer is just an object with props type
 */
export type GenericOfferOptions = Record<string, unknown>;

/**
 * Offer data type
 */
export interface OfferData<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
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
  signature: string;
}
