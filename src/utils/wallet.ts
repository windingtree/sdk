import { Mnemonic, HDNodeWallet, randomBytes } from 'ethers';

/**
 * Generates random wallet mnemonic
 *
 * @returns {string}
 */
export const generateMnemonic = (): string => Mnemonic.fromEntropy(randomBytes(16)).phrase;

/**
 * Returns an account from wallet (created from seed phrase)
 *
 * @param {string} phrase
 * @param {number} index
 * @returns {string}
 */
export const deriveAccount = (phrase: string, index: number): string =>
  HDNodeWallet.fromPhrase(phrase).derivePath(`m/44'/60'/0'/0/${index}`).address;
