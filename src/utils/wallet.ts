import { Mnemonic, HDNodeWallet, randomBytes } from 'ethers';

export const generateMnemonic = (): string => Mnemonic.fromEntropy(randomBytes(16)).phrase;

export const deriveAccount = (phrase: string, index: number): string =>
  HDNodeWallet.fromPhrase(phrase).derivePath(`m/44'/60'/0'/0/${index}`).address;
