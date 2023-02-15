import 'mocha';
import { expect } from 'chai';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('test');

describe('SDK', () => {
  before(async () => {
    logger.trace('before');
  });

  it('should be true', async () => {
    expect(true).to.be.true;
  });
});
