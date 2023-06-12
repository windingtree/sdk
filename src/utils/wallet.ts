import {
  Account,
  generateMnemonic as generateMnemonic_,
  english,
  mnemonicToAccount,
} from 'viem/accounts';

/**
 * Generates random wallet mnemonic
 *
 * @returns {string}
 */
export const generateMnemonic = (): string => generateMnemonic_(english);

/**
 * Returns an account from wallet (created from seed phrase)
 *
 * @param {string} mnemonic
 * @param {number} addressIndex
 * @returns {Account}
 */
export const deriveAccount = (
  mnemonic: string,
  addressIndex: number,
): Account =>
  mnemonicToAccount(mnemonic, {
    accountIndex: 0,
    changeIndex: 0,
    addressIndex,
  });
