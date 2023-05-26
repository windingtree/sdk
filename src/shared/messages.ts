import { Address, Hash, verifyTypedData, WalletClient, HDAccount } from 'viem';
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
export const offerEip712Types = {
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
  /** Ethereum local account */
  hdAccount?: HDAccount;
  /** Ethereum wallet client */
  walletClient?: WalletClient;
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
  /** Ethereum wallet client */
  walletClient?: WalletClient;
  /** Ethereum local account */
  hdAccount?: HDAccount;
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
    hdAccount,
    walletClient,
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

  if (hdAccount && hdAccount.type === 'local') {
    signature = await hdAccount.signTypedData({
      domain,
      types: offerEip712Types,
      primaryType: 'Offer',
      message: unsignedOfferPayload,
    });
  } else if (walletClient && !signatureOverride) {
    const [account] = await walletClient.getAddresses();

    signature = await walletClient.signTypedData({
      account,
      domain,
      types: offerEip712Types,
      primaryType: 'Offer',
      message: unsignedOfferPayload,
    });
  } else if (signatureOverride) {
    signature = signatureOverride;
  } else {
    throw new Error(
      'Either hdAccount or walletClient or signatureOverride must be provided with options',
    );
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
 * EIP-712 JSON schema types for checkIn/Out voucher
 */
export const checkInOutTypes = {
  Voucher: [
    {
      name: 'id',
      type: 'bytes32',
    },
    {
      name: 'signer',
      type: 'address',
    },
  ],
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
  walletClient,
  hdAccount,
}: CreateCheckInOutSignatureArgs): Promise<Hash> => {
  if (hdAccount && hdAccount.type === 'local') {
    return await hdAccount.signTypedData({
      domain,
      types: checkInOutTypes,
      primaryType: 'Voucher',
      message: {
        id: offerId,
        signer: hdAccount.address,
      },
    });
  }

  if (walletClient) {
    const [account] = await walletClient.getAddresses();
    return await walletClient.signTypedData({
      account,
      domain,
      types: checkInOutTypes,
      primaryType: 'Voucher',
      message: {
        id: offerId,
        signer: account,
      },
    });
  }

  throw new Error('Either hdAccount or walletClient must be provided with options');
};
