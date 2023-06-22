/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  GenericQuery,
  GenericOfferOptions,
  RequestData,
} from '../src/shared/types.js';
import { Hash, HDAccount, TypedDataDomain } from 'viem';
import { buildRequest, buildOffer } from '../src/shared/messages.js';
import { randomSalt } from '@windingtree/contracts';
import { expect } from 'vitest';

process.on('unhandledRejection', (error) => {
  console.log('Unhandled rejection detected:', error);
});

export { expect };

export const expectDeepEqual = (
  obj1: any,
  obj2: any,
  parent?: string,
): void => {
  for (const key of Object.keys(obj1)) {
    if (typeof obj1[key] === 'object') {
      expectDeepEqual(obj1[key], obj2[key], key);
      continue;
    }
    expect(obj1[key]).to.equal(
      obj2[key],
      `${parent ? parent + '.' : ''}${key}`,
    );
  }
};

export interface CustomQuery extends GenericQuery {
  guests: bigint;
  rooms: bigint;
}

export interface CustomOfferOptions extends GenericOfferOptions {
  room: string;
  checkIn: bigint;
  checkOut: bigint;
}

export const createRequest = async (
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

export const createOffer = (
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
