import { expect } from './setup.js';
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
