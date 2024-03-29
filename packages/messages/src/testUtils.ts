import {
  GenericQuery,
  GenericOfferOptions,
  RequestData,
  DealRecord,
  DealStatus,
} from '@windingtree/sdk-types';
import { Hash, HDAccount, TypedDataDomain } from 'viem';
import { randomSalt } from '@windingtree/contracts';
import { buildRequest, buildOffer } from './index.js';

export interface CustomQuery extends GenericQuery {
  guests: bigint;
  rooms: bigint;
}

export interface CustomOfferOptions extends GenericOfferOptions {
  room: string;
  checkIn: bigint;
  checkOut: bigint;
}

/**
 * Creates a random request
 *
 * @param {string} topic
 * @param {(bigint | string)} [expire=BigInt(1)]
 */
export const createRandomRequest = async (
  topic: string,
  expire: bigint | string = BigInt(1),
) =>
  buildRequest<CustomQuery>({
    expire,
    nonce: BigInt(1),
    topic,
    query: {
      guests: BigInt(2),
      rooms: BigInt(1),
    },
  });

/**
 * Creates a random offer
 *
 * @param {RequestData<CustomQuery>} request
 * @param {(bigint | string)} expire
 * @param {TypedDataDomain} typedDomain
 * @param {Hash} supplierId
 * @param {HDAccount} signer
 */
export const createRandomOffer = (
  request: RequestData<CustomQuery>,
  expire: bigint | string,
  typedDomain: TypedDataDomain,
  supplierId: Hash,
  signer: HDAccount,
) =>
  buildOffer<CustomQuery, CustomOfferOptions>({
    domain: typedDomain,
    account: signer,
    supplierId,
    expire,
    request,
    options: {
      room: 'big',
      checkIn: 1n,
      checkOut: 2n,
    },
    payment: [
      {
        id: randomSalt(),
        asset: signer.address, // fake
        price: 1n,
      },
    ],
    cancel: [
      {
        time: 1n,
        penalty: 1n,
      },
    ],
    checkIn: 1n,
    checkOut: 1n,
    transferable: true,
  });

export const buildRandomDeal = async (
  signer: HDAccount,
  supplierId: Hash,
): Promise<DealRecord> => {
  const typedDomain = {
    chainId: 1,
    name: 'Test',
    version: '1',
    contract: signer.address,
  };
  const request = await createRandomRequest('test', '100s');
  const offer = await createRandomOffer(
    request,
    '200s',
    typedDomain,
    supplierId,
    signer,
  );

  return {
    chainId: typedDomain.chainId,
    created: BigInt(Math.round(Date.now() / 1000)),
    offer,
    retailerId: 'test',
    buyer: '0x0',
    price: BigInt(1),
    asset: '0x0',
    status: DealStatus.Claimed,
  };
};
