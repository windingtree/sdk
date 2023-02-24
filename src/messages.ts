import { Signer, TypedDataField, getAddress, Signature } from 'ethers';
import { verifyTypedData } from '@ethersproject/wallet';
import { ContractConfig } from './contract.js';
import { hashObject } from './utils/hash.js';
import { uuid4 } from './utils/uid.js';
import { parseSeconds } from './utils/time.js';

// Common message structure
export interface GenericMessage {
  id: string; // Unique message Id
  expire: number; // Expiration time in seconds
  nonce?: number; // A number that reflects the version of the message
  [key: string]: unknown;
}

export type GenericQuery = Record<string, unknown>;

// Request data structure
export interface RequestData<RequestQuery extends GenericQuery> extends GenericMessage {
  query: RequestQuery; // Industry specific query type
}

// Offered payment option
export interface PaymentOption {
  id: string; // Unique payment option Id
  price: string; // Asset price in WEI
  asset: string; // ERC20 asset contract address
}

// Offered cancellation option
export interface CancelOption {
  time: number; // Seconds before checkIn
  penalty: number; // percents of total sum
}

// Offer payload
export interface UnsignedOffer {
  supplierId: string; // Unique supplier Id registered on the protocol contract
  chainId: number; // Target network chain Id
  requestHash: string; // <keccak256(request.hash())>
  optionsHash: string; // <keccak256(JSON.stringify(offer.options))>
  paymentHash: string; // <keccak256(JSON.stringify(offer.payment))>
  cancelHash: string; // <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))>
  transferable: boolean; // makes the deal NFT transferable or not
  checkIn: number; // check-in time in seconds
}

export interface SignedOffer extends UnsignedOffer {
  signature: string; // EIP-712 TypedSignature(UnsignedOffer)
}

// Generic offer is just an object with props
export type GenericOfferOptions = Record<string, unknown>;

// Base offer parameters
export interface BaseOfferData<OfferOptions extends GenericOfferOptions> {
  options: OfferOptions; // Supplier-specific offer options
  payment: PaymentOption[]; // Payment options
  cancel: CancelOption[]; // Cancellation options
}

// Final offer data
export interface OfferData<RequestQuery extends GenericQuery, OfferOptions extends GenericOfferOptions>
  extends GenericMessage,
    BaseOfferData<OfferOptions> {
  request: RequestData<RequestQuery>; // Copy of associated request
  offer: UnsignedOffer;
  signature: string; // EIP-712 TypedSignature(UnsignedOffer)
}

// EIP-712 types for offer
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

// Builds a request
export const buildRequest = async <RequestQuery extends GenericQuery>(
  expire: string | number,
  nonce: number,
  query: RequestQuery,
): Promise<RequestData<RequestQuery>> => ({
  id: uuid4(),
  expire: parseSeconds(expire),
  nonce,
  query,
});

// Builds an offer
export const buildOffer = async <RequestQuery extends GenericQuery, OfferOptions extends GenericOfferOptions>(
  contract: ContractConfig,
  signer: Signer,
  expire: string | number,
  supplierId: string,
  request: RequestData<RequestQuery>,
  baseData: BaseOfferData<OfferOptions>,
  checkIn: number,
  transferable = true,
): Promise<OfferData<RequestQuery, OfferOptions>> => {
  baseData.cancel = baseData.cancel ?? [];
  expire = parseSeconds(expire);

  const unsignedOffer: UnsignedOffer = {
    supplierId,
    chainId: Number(contract.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(baseData.options),
    paymentHash: hashObject(baseData.payment),
    cancelHash: hashObject(baseData.cancel),
    checkIn,
    transferable,
  };

  const signature = await signer.signTypedData(
    {
      name: contract.name,
      version: contract.version,
      chainId: contract.chainId,
      verifyingContract: contract.address,
    },
    offerEip712Types,
    unsignedOffer,
  );

  return {
    id: uuid4(),
    expire,
    nonce: 1,
    request,
    ...baseData,
    offer: unsignedOffer,
    signature,
  };
};

// Verify signed offer
export const verifyOffer = <RequestQuery extends GenericQuery, OfferOptions extends GenericOfferOptions>(
  contract: ContractConfig,
  supplierAddress: string,
  offer: OfferData<RequestQuery, OfferOptions>,
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
    offer.offer,
    Signature.from(offer.signature),
  );

  if (recoveredAddress !== supplierAddress) {
    throw new Error(`Invalid offer signer ${recoveredAddress}`);
  }
};
