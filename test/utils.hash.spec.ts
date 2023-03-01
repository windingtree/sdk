import { expect } from './setup.js';
import { solidityPackedKeccak256 } from 'ethers';
import { hashObject } from '../src/utils/hash.js';

describe('Utils.hash', () => {
  const obj = {
    test: 'value',
  };

  it('should hash the object', async () => {
    expect(hashObject(obj)).to.be.eq(solidityPackedKeccak256(['string'], [JSON.stringify(obj)]));
  });
});
