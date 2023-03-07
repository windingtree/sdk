import { expect } from './setup.js';
import { validateDurationFormat, parseSeconds } from '../src/utils/time.js';

describe('Utils.time', () => {
  describe('#validateDurationFormat', () => {
    it('should throw if format unknown', () => {
      expect(() => validateDurationFormat('t')).to.throw('Unknown duration time format');
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
      expect(parseSeconds('1ms')).to.eq(0);
      expect(parseSeconds('1s')).to.eq(1);
      expect(parseSeconds('1m')).to.eq(60);
      expect(parseSeconds('1h')).to.eq(60 * 60);
      expect(parseSeconds('1d')).to.eq(60 * 60 * 24);
      expect(parseSeconds('1y')).to.eq(60 * 60 * 24 * 365.25);
    });

    it('should pass numbers', () => {
      expect(parseSeconds(1)).to.eq(1);
    });
  });
});
