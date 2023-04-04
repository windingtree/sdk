import { AbstractSigner, TypedDataField, getAddress, Signature, verifyTypedData } from 'ethers';
import { ContractConfig } from '../utils/contract.js';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { nowSec, parseSeconds } from '../utils/time.js';

/**
 * Generic message data type
 */
export interface GenericMessage {
  /** Unique message Id */
  id: string;
  /** Expiration time in seconds */
  expire: number;
  /** A number that reflects the version of the message */
  nonce: number;
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
  expire: string | number;
  /** Nonce */
  nonce: number;
  /** Topic */
  topic: string;
  /** Request query */
  query: CustomRequestQuery;
  /** If allowed request Id override */
  idOverride?: string;
}

/**
 * Builds a request
 *
 * @template {CustomRequestQuery}
 * @param {BuildRequestOptions<CustomRequestQuery>} requestOptions
 * @returns
 */
export const buildRequest = async <CustomRequestQuery extends GenericQuery>(
  requestOptions: BuildRequestOptions<CustomRequestQuery>,
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<RequestData<CustomRequestQuery>> => {
  const { expire, nonce, topic, query, idOverride } = requestOptions;
  // @todo Validate request options
  return {
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce,
    topic,
    query,
  };
};

/**
 * Offered payment option type
 */
export interface PaymentOption {
  /** Unique payment option Id */
  id: string;
  /** Asset price in WEI */
  price: string;
  /** ERC20 asset contract address */
  asset: string;
}

/**
 * Offered cancellation option type
 */
export interface CancelOption {
  /** Seconds before checkIn */
  time: number;
  /** Percents of total sum */
  penalty: number;
}

/**
 * Unsigned offer payload type
 */
export interface UnsignedOfferPayload {
  /** Unique supplier Id registered on the protocol contract */
  supplierId: string;
  /** Target network chain Id */
  chainId: number;
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
  checkIn: number;
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

/**
 * EIP-712 JSON schema types for offer
 */
export const offerEip712Types: Record<string, Array<TypedDataField>> = {
  Offer: [
    {
      name: 'supplierId',
      type: 'bytes32',
    },
    {
      name: 'chainId',
      type: 'uint256',
    },
    {
      name: 'requestHash',
      type: 'bytes32',
    },
    {
      name: 'optionsHash',
      type: 'bytes32',
    },
    {
      name: 'paymentHash',
      type: 'bytes32',
    },
    {
      name: 'cancelHash',
      type: 'bytes32',
    },
    {
      name: 'transferable',
      type: 'bool',
    },
    {
      name: 'checkIn',
      type: 'uint256',
    },
  ],
};

/**
 * Type for `buildOffer` method options
 */
export interface BuildOfferOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Smart contract configuration */
  contract: ContractConfig;
  /** Ethers.js signer */
  signer?: AbstractSigner;
  /** Unique supplier Id */
  supplierId: string;
  /** Expiration time: duration (string) or seconds (number) */
  expire: string | number;
  /** Request data */
  request: RequestData<CustomRequestQuery>;
  /** Offer options */
  options: CustomOfferOptions;
  /** Offer payment options */
  payment: PaymentOption[];
  /** Offer cancellation options */
  cancel: CancelOption[];
  /** Check In time in seconds */
  checkIn: number;
  /** Transferrable offer flag */
  transferable?: boolean;
  /** The possibility to override an offer Id flag */
  idOverride?: string;
  /** The possibility to override an offer signature flag */
  signatureOverride?: string;
}

/**
 * Builds an offer
 *
 * @template {CustomRequestQuery}
 * @template {CustomOfferOptions}
 * @param {BuildOfferOptions<CustomRequestQuery, CustomOfferOptions>} offerOptions
 * @returns
 */
export const buildOffer = async <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  offerOptions: BuildOfferOptions<CustomRequestQuery, CustomOfferOptions>,
): Promise<OfferData<CustomRequestQuery, CustomOfferOptions>> => {
  const {
    supplierId,
    contract,
    request,
    options,
    payment,
    cancel,
    checkIn,
    transferable,
    signer,
    signatureOverride,
    idOverride,
    expire,
  } = offerOptions;

  // @todo Validate offer options

  const unsignedOfferPayload: UnsignedOfferPayload = {
    supplierId,
    chainId: Number(contract.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(options),
    paymentHash: hashObject(payment),
    cancelHash: hashObject(cancel),
    checkIn,
    transferable: transferable ?? true,
  };

  let signature: string | undefined;

  if (signer && !signatureOverride) {
    signature = await signer.signTypedData(
      {
        name: contract.name,
        version: contract.version,
        chainId: contract.chainId,
        verifyingContract: contract.address,
      },
      offerEip712Types,
      unsignedOfferPayload,
    );
  } else if (signatureOverride) {
    signature = signatureOverride;
  } else {
    throw new Error('Either signer or signatureOverride must be provided');
  }

  return {
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce: 1,
    request,
    options,
    payment,
    cancel,
    payload: unsignedOfferPayload,
    signature,
  };
};

/**
 * Verifies signed offer
 *
 * @template {CustomRequestQuery}
 * @template {CustomOfferOptions}
 * @param {ContractConfig} contract
 * @param {string} supplierAddress
 * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
 */
export const verifyOffer = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  contract: ContractConfig,
  supplierAddress: string,
  offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
): void => {
  supplierAddress = getAddress(supplierAddress);
  const recoveredAddress = verifyTypedData(
    {
      name: contract.name,
      version: contract.version,
      chainId: contract.chainId,
      verifyingContract: contract.address,
    },
    offerEip712Types,
    offer.payload,
    Signature.from(offer.signature),
  );

  if (recoveredAddress !== supplierAddress) {
    throw new Error(`Invalid offer signer ${supplierAddress}`);
  }
};
