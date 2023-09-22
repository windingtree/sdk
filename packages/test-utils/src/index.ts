/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect } from 'vitest';
import { Hash, HDAccount } from 'viem';
import { DealRecord, DealStatus } from '@windingtree/sdk-types';
import {
  createRandomOffer,
  createRandomRequest,
} from '@windingtree/sdk-messages';

export * from 'vitest';

process.on('unhandledRejection', (error) => {
  console.log('Unhandled rejection detected:', error);
});

/**
 * Validates objects equality
 *
 * @param {*} obj1
 * @param {*} obj2
 * @param {string} [parent]
 */
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
