import { expect } from './setup.js';
import { createLogger, enable, disable } from '../src/utils/logger.js';
import { describe, it } from 'vitest';

describe('Utils.logger', () => {
  describe('#createLogger', () => {
    it('creates a logger', () => {
      const log = createLogger('hello');
      expect(log).to.be.a('function');
      expect(log).to.have.property('error').that.is.a('function');
      expect(log).to.have.property('enabled');
    });
  });

  describe('#enable', () => {
    const log = createLogger('enable');
    disable();

    it('should enable logger', () => {
      expect(log.enabled).to.be.false;
      enable('enable');
      expect(log.enabled).to.be.true;
    });
  });

  describe('#disable', () => {
    const log = createLogger('disable');

    it('should disable logger', () => {
      disable();
      expect(log.enabled).to.be.false;
    });
  });
});
