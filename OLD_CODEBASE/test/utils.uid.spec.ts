import { describe, it, expect } from './setup.js';
import { mnemonicToAccount } from 'viem/accounts';
import { simpleUid, randomSalt } from '@windingtree/contracts';
import { generateMnemonic } from '../src/utils/wallet.js';
import { supplierId } from '../src/utils/uid.js';

describe('Utils.uid', () => {
  const bytes32RegExp = /^0x[a-fA-F0-9]{64}$/;

  describe('#simpleUid', () => {
    it('should throw if invalid length provided', () => {
      expect(() => simpleUid(4)).to.throw(
        'Length value must be between 5 and 14',
      );
      expect(() => simpleUid(15)).to.throw(
        'Length value must be between 5 and 14',
      );
    });

    it('should generate simple uid', () => {
      const set = new Set();
      const num = 10;
      for (let i = 0; i < num; i++) {
        set.add(simpleUid());
      }
      expect(set.size).to.be.eq(num);
    });
  });

  describe('#randomSalt', () => {
    it('should generate bytes32-formatted random salt', () => {
      expect(bytes32RegExp.exec(randomSalt())).to.not.null;
    });
  });

  describe('#supplierId', () => {
    const owner = mnemonicToAccount(generateMnemonic());

    it('should generate bytes32-formatted supplierId', () => {
      expect(bytes32RegExp.exec(supplierId(randomSalt(), owner.address))).to.not
        .null;
    });
  });
});
