import { expect } from './setup.js';
import { beforeAll, describe, it } from 'vitest';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('test');

describe('SDK', () => {
  beforeAll(() => {
    logger.trace('before');
  });

  it('should be true', () => {
    expect(true).to.be.true;
  });
});
