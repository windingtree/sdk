/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeAll, describe, expect, it } from '@windingtree/sdk-test-utils';
import { mnemonicToAccount } from 'viem/accounts';
import { randomSalt } from '@windingtree/contracts';
import { generateMnemonic, supplierId as spId } from '@windingtree/sdk-utils';
import { memoryStorage, Storage } from '@windingtree/sdk-storage';
import { DealRecord } from '@windingtree/sdk-types';
import { DealsDb, DealsDbOptions } from '../src/deals.js';
import { buildRandomDeal } from '@windingtree/sdk-messages';

describe('DealsDb', () => {
  const signer = mnemonicToAccount(generateMnemonic());
  const supplierId = spId(signer.address, randomSalt());
  let dealsDbOptions: DealsDbOptions;
  let storage: Storage;
  let dealsDb: DealsDb;

  beforeAll(async () => {
    storage = await memoryStorage.createInitializer({
      scope: 'deals',
    })();
    dealsDbOptions = {
      storage,
      prefix: 'test',
    };
    dealsDb = new DealsDb(dealsDbOptions);
  });

  describe('#constructor', () => {
    it('should correctly initialize with valid parameters', () => {
      expect(dealsDb).toBeDefined();
      expect(dealsDb.prefix).toEqual(`${dealsDbOptions.prefix}_api_deals_`);
      expect(dealsDb.storage).toEqual(storage);
    });
  });

  describe('#set', () => {
    it('set deal record to the storage', async () => {
      const deal = await buildRandomDeal(signer, supplierId);
      await dealsDb.set(deal);
      const result = await dealsDb.storage.get<DealRecord>(
        `test_api_deals_${deal.offer.id}`,
      );
      expect(result).toEqual(deal);
    });
  });

  describe('#get', () => {
    it('get deal record from the storage', async () => {
      const deal = await buildRandomDeal(signer, supplierId);
      await dealsDb.set(deal);
      const result = await dealsDb.get(deal.offer.id);
      expect(result).toStrictEqual(deal);
    });

    it('should throw an error when the deal is not found', async () => {
      const unknownId = '0xNonexistentId';
      await expect(dealsDb.get(unknownId)).rejects.toThrow(
        `Deal ${unknownId} not found`,
      );
    });
  });

  describe('#getAll', () => {
    let records: DealRecord[];

    beforeAll(async () => {
      await (dealsDb.storage as memoryStorage.MemoryStorage).reset();
      records = await Promise.all(
        Array(10)
          .fill('')
          .map(async (_) => buildRandomDeal(signer, supplierId)),
      );
      await Promise.all(records.map((r) => dealsDb.set(r)));
    });

    it('get all deal records from the storage', async () => {
      const pagination = { start: 0, skip: 10 };
      const deals = await dealsDb.getAll(pagination);
      expect(deals.records.length).toEqual(pagination.skip);
      deals.records.forEach((d) => {
        const record = records.find((r) => r.offer.id === d.offer.id);
        expect(record).to.be.deep.eq(d);
      });
      expect(deals.total).to.be.equal(records.length);
      expect(deals.start).to.be.equal(pagination.start);
      expect(deals.skip).to.be.equal(pagination.skip);
    });

    it('should return an empty array when no deals are found', async () => {
      const deals = await dealsDb.getAll({ start: 100, skip: 10 });
      expect(deals.records.length).toBe(0);
    });

    it('should return all remaining deals when the skip count exceeds available deals', async () => {
      const deals = await dealsDb.getAll({ start: 5, skip: 10 });
      expect(deals.records.length).toBe(5);
    });
  });
});
