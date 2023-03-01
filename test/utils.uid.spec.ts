import { expect } from './setup.js';
import { Wallet } from 'ethers';
import { simpleUid, uuid4, randomSalt, supplierId } from '../src/utils/uid.js';

describe('Utils.uid', () => {
  const bytes32RegExp = /^0x[a-fA-F0-9]{64}$/;

  describe('#simpleUid', () => {
    it('should throw if invalid length provided', async () => {
      expect(() => simpleUid(4)).to.throw('Length value must be between 5 and 14');
      expect(() => simpleUid(15)).to.throw('Length value must be between 5 and 14');
    });

    it('should generate simple uid', async () => {
      const set = new Set();
      const num = 10;
      for (let i = 0; i < num; i++) {
        set.add(simpleUid());
      }
      expect(set.size).to.be.eq(num);
    });
  });

  describe('#uuid4', () => {
    const match = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

    it('should generate uuid v4', async () => {
      const set = new Set<string>();
      const num = 10;
      for (let i = 0; i < num; i++) {
        set.add(uuid4());
      }
      expect(set.size).to.be.eq(num);
      for (const id of set) {
        expect(match.exec(id)).not.to.be.null;
      }
    });
  });

  describe('#randomSalt', () => {
    it('should generate bytes32-formatted random salt', async () => {
      expect(bytes32RegExp.exec(randomSalt())).to.not.null;
    });
  });

  describe('#supplierId', () => {
    const owner = Wallet.createRandom();

    it('should generate bytes32-formatted supplierId', async () => {
      expect(bytes32RegExp.exec(supplierId(randomSalt(), owner.address))).to.not.null;
    });
  });
});
