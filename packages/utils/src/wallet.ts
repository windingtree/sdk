import {
  HDAccount,
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
 * @returns {HDAccount}
 */
export const deriveAccount = (
  mnemonic: string,
  addressIndex: number,
): HDAccount =>
  mnemonicToAccount(mnemonic, {
    accountIndex: 0,
    changeIndex: 0,
    addressIndex,
  });

/**
 * Retrieves a private key from an account
 *
 * @param {HDAccount} account
 * @returns {string}
 */
export const getPk = (account: HDAccount): string =>
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Array.from(account.getHdKey().privateKey!)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
