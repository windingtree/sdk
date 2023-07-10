import { describe, it, expect } from './setup.js';
import {
  validateDurationFormat,
  parseSeconds,
  millisToSec,
  nowSec,
  isExpired,
} from '../src/utils/time.js';

describe('Utils.time', () => {
  describe('#validateDurationFormat', () => {
    it('should throw if format unknown', () => {
      expect(() => validateDurationFormat('t')).to.throw(
        'Unknown duration time format',
      );
    });

    it('should validate known types', () => {
      expect(() => validateDurationFormat('ms')).not.to.throw;
      expect(() => validateDurationFormat('s')).not.to.throw;
      expect(() => validateDurationFormat('m')).not.to.throw;
      expect(() => validateDurationFormat('h')).not.to.throw;
      expect(() => validateDurationFormat('d')).not.to.throw;
      expect(() => validateDurationFormat('y')).not.to.throw;
    });
  });

  describe('#parseSeconds', () => {
    it('should throw if format unknown', () => {
      expect(() => parseSeconds('t5')).to.throw('Unknown duration time format');
    });

    it('should validate known types', () => {
      expect(parseSeconds('1ms')).to.eq(0n);
      expect(parseSeconds('1s')).to.eq(1n);
      expect(parseSeconds('1m')).to.eq(60n);
      expect(parseSeconds('1h')).to.eq(BigInt(60 * 60));
      expect(parseSeconds('1d')).to.eq(BigInt(60 * 60 * 24));
      expect(parseSeconds('1y')).to.eq(BigInt(60 * 60 * 24 * 365.25));
    });

    it('should pass numbers', () => {
      expect(parseSeconds(1)).to.eq(1n);
    });
  });

  describe('#millisToSec', () => {
    it('should convert millis to seconds', () => {
      expect(millisToSec(1000)).to.eq(1);
    });

    it('should round sec value', () => {
      expect(millisToSec(100)).to.eq(0);
      expect(millisToSec(1567)).to.eq(2);
    });
  });

  describe('#nowSec', () => {
    it('should return valid time', () => {
      expect(nowSec()).to.be.gt(new Date('1970-01-01T00:00:00Z').getSeconds());
    });
  });

  describe('#isExpired', () => {
    it('should detect expired time', () => {
      const now = nowSec();
      expect(isExpired(BigInt(now + 2000))).to.be.false;
      expect(isExpired(BigInt(now - 1))).to.be.true;
    });
  });
});
