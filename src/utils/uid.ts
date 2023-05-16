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
