import { expect } from './setup.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('test');

describe('SDK', () => {
  before(() => {
    logger.trace('before');
  });

  it('should be true', () => {
    expect(true).to.be.true;
  });
});
