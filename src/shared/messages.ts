import { Address, Hash, verifyTypedData, HDAccount, PrivateKeyAccount } from 'viem';
import { TypedDataDomain } from 'abitype';
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
import {
  hashCancelOptionArray,
  hashObject,
  hashPaymentOptionArray,
  randomSalt,
  offerEip712Types,
  checkInOutEip712Types,
} from '@windingtree/contracts';
import { parseExpire } from '../utils/time.js';

export type Account = HDAccount | PrivateKeyAccount;

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
 * Type for `buildOffer` method options
 */
export interface BuildOfferOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Typed domain configuration */
  domain: TypedDataDomain;
  /** Unique supplier Id */
  supplierId: Hash;
  /** Expiration time: duration (string) or seconds (number) */
  expire: string | bigint;
  /** Request data */
  request: RequestData<CustomRequestQuery>;
  /** Offer options */
  options: CustomOfferOptions;
  /** Offer payment options */
  payment: PaymentOption[];
  /** Offer cancellation options */
  cancel: CancelOption[];
  /** Check-in time in seconds */
  checkIn: bigint;
  /** Check-out time in seconds */
  checkOut: bigint;
  /** Transferrable offer flag */
  transferable?: boolean;
  /** The possibility to override an offer Id flag */
  idOverride?: Hash;
  /** The possibility to override an offer signature flag */
  signatureOverride?: Hash;
  /** Ethereum wallet client */
  account?: Account;
}

export interface VerifyOfferArgs<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Typed data domain */
  domain: TypedDataDomain;
  /** Offer signer account address */
  address: Address;
  offer: OfferData<CustomRequestQuery, CustomOfferOptions>;
}

/**
 * createCheckInOutSignature function arguments
 */
export interface CreateCheckInOutSignatureArgs {
  /** Offer Id */
  offerId: Hash;
  /** Typed data domain */
  domain: TypedDataDomain;
  /** Ethereum local account */
  account: Account;
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
    domain,
    request,
    options,
    payment,
    cancel,
    checkIn,
    checkOut,
    transferable,
    signatureOverride,
    idOverride,
    account,
  } = offerOptions;
  let { expire } = offerOptions;

  // @todo Validate offer options

  const id = idOverride ?? randomSalt();
  expire = parseExpire(expire);

  if (!domain.chainId) {
    throw new Error('Chain Id must be provided with a typed domain');
  }

  const unsignedOfferPayload: UnsignedOfferPayload = {
    id,
    expire,
    supplierId,
    chainId: BigInt(domain.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(options),
    paymentHash: hashPaymentOptionArray(payment),
    cancelHash: hashCancelOptionArray(cancel),
    checkIn: BigInt(checkIn),
    checkOut: BigInt(checkOut),
    transferable: transferable ?? true,
  };

  let signature: Hash | undefined;

  if (account && !signatureOverride) {
    signature = await account.signTypedData({
      domain,
      types: offerEip712Types,
      primaryType: 'Offer',
      message: unsignedOfferPayload,
    });
  } else if (signatureOverride) {
    signature = signatureOverride;
  } else {
    throw new Error('Either walletClient or signatureOverride must be provided with options');
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
 * @param {VerifyOfferArgs<CustomRequestQuery, CustomOfferOptions>} args Function arguments
 * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
 */
export const verifyOffer = async <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>({
  domain,
  address,
  offer,
}: VerifyOfferArgs<CustomRequestQuery, CustomOfferOptions>): Promise<void> => {
  const isValid = await verifyTypedData({
    address,
    domain,
    types: offerEip712Types,
    primaryType: 'Offer',
    message: offer.payload,
    signature: offer.signature,
  });

  if (!isValid) {
    throw new Error(`Invalid offer signer ${address}`);
  }
};

/**
 * Create EIP-712 signature for checkIn/Out voucher
 *
 * @param {CreateCheckInOutSignatureArgs} args Function arguments
 * @returns {Promise<Hash>}
 */
export const createCheckInOutSignature = async ({
  offerId,
  domain,
  account,
}: CreateCheckInOutSignatureArgs): Promise<Hash> =>
  await account.signTypedData({
    domain,
    types: checkInOutEip712Types,
    primaryType: 'Voucher',
    message: {
      id: offerId,
      signer: account.address,
    },
  });
