import { solidityPackedKeccak256 } from 'ethers';

/**
 * Generates simple unique Id
 *
 * @param {number} [length=14]
 * @returns {string}
 */
export const simpleUid = (length = 14): string => {
  if (length < 5 || length > 14) {
    throw new Error('Length value must be between 5 and 14');
  }
  return Math.random()
    .toString(16)
    .replace('.', '')
    .split('')
    .sort(() => (Math.random() > 0.5 ? 1 : -1))
    .join('')
    .slice(0, length);
};

/**
 * Generates UUID v4
 *
 * @returns {string}
 */
export const uuid4 = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(36);
  });

/**
 * Generates random salt (bytes32 string)
 *
 * @returns {string}
 */
export const randomSalt = (): string => solidityPackedKeccak256(['string'], [simpleUid()]);

/**
 * Generates supplier Id (bytes32 string)
 *
 * @param {string} salt
 * @param {string} address
 * @returns {string}
 */
export const supplierId = (salt: string, address: string): string =>
  solidityPackedKeccak256(['string', 'address'], [salt, address]);
