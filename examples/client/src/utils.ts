import { formatUnits, Hash } from 'viem';

export const ZeroHash: Hash = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Makes shorter text with ellipsis in the center
export const centerEllipsis = (text: string, width = 4, prefix = 2): string =>
  text
    ? text.length > width * 2 + prefix
      ? `${text.substring(0, width + prefix)}...${text.substring(text.length - width - prefix)}`
      : text
    : '';

// Formats balance value
export const formatBalance = (balance: bigint, decimals: number): string => {
  const ether = formatUnits(balance, decimals);
  const decimalPart = ether.split('.')[1] || '';
  const paddedDecimalPart = decimalPart.padEnd(decimals, '0');
  return `${ether.split('.')[0]}.${paddedDecimalPart.slice(0, decimals)}`;
};

export const parseWalletError = (error: any): string => {
  if (!error.code) {
    return error.message;
  }
  const words = (error.code as string).split('_').map((w) => w.toLowerCase());
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ') || 'Unknown error';
};
