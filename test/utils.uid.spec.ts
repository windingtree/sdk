import 'mocha';
import { expect } from 'chai';
import { simpleUid } from '../src/utils/uid.js';

describe('Utils.uid', () => {
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
});
