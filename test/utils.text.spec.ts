import { describe, it, expect } from './setup.js';
import { decodeText, encodeText } from '../src/utils/text.js';

describe('Utils.text', () => {
  describe('#decodeText', () => {
    const text = 'test';

    it('should decode text', () => {
      const encoded = new TextEncoder().encode(text);
      expect(decodeText(encoded)).to.eq(text);
    });
  });

  describe('#encodeText', () => {
    const text = 'test';
    const encoded = new TextEncoder().encode(text);

    it('should encode text', () => {
      expect(encodeText(text)).to.deep.eq(encoded);
    });
  });
});
