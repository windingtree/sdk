import {
  BigNumberish,
  AbstractSigner,
  TypedDataField,
  getAddress,
  Signature,
  verifyTypedData,
} from 'ethers';
import {
  BuildRequestOptions,
  CancelOption,
  GenericOfferOptions,
  GenericQuery,
  OfferData,
  PaymentOption,
  RequestData,
  UnsignedOfferPayload,
} from './types.js';
import { ContractConfig } from '../utils/contract.js';
import { hashCancelOptionArray, hashObject, hashPaymentOptionArray } from '../utils/hash.js';
import { randomSalt } from '../utils/uid.js';
import { parseExpire } from '../utils/time.js';

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
    id: idOverride ?? randomSalt(),
    expire: parseExpire(expire),
    nonce,
    topic,
    query,
  };
};

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
  expire: string | BigNumberish;
  /** Request data */
  request: RequestData<CustomRequestQuery>;
  /** Offer options */
  options: CustomOfferOptions;
  /** Offer payment options */
  payment: PaymentOption[];
  /** Offer cancellation options */
  cancel: CancelOption[];
  /** Check-in time in seconds */
  checkIn: BigNumberish;
  /** Check-out time in seconds */
  checkOut: BigNumberish;
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
    checkOut,
    transferable,
    signer,
    signatureOverride,
    idOverride,
  } = offerOptions;
  let { expire } = offerOptions;

  // @todo Validate offer options

  const id = idOverride ?? randomSalt();
  expire = parseExpire(expire);

  const unsignedOfferPayload: UnsignedOfferPayload = {
    id,
    expire,
    supplierId,
    chainId: BigInt(contract.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(options),
    paymentHash: hashPaymentOptionArray(payment),
    cancelHash: hashCancelOptionArray(cancel),
    checkIn: BigInt(checkIn),
    checkOut: BigInt(checkOut),
    transferable: transferable ?? true,
  };

  let signature: string | undefined;

  if (signer && !signatureOverride) {
    signature = await signer.signTypedData(
      {
        name: contract.name,
        version: contract.version,
        chainId: BigInt(contract.chainId),
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
    id,
    expire,
    nonce: BigInt(1),
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
