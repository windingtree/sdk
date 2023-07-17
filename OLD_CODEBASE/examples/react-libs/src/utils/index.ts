import { formatUnits, Hash } from 'viem';

export const ZeroHash: Hash =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

// Makes shorter text with ellipsis in the center
export const centerEllipsis = (text: string, width = 4, prefix = 2): string =>
  text
    ? text.length > width * 2 + prefix
      ? `${text.substring(0, width + prefix)}...${text.substring(
          text.length - width - prefix,
        )}`
      : text
    : '';

// Formats balance value
export const formatBalance = (balance: bigint, decimals: number): string => {
  const ether = formatUnits(balance, 18);
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

/**
 * Copies a text to clipboard
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  } else if (document.execCommand) {
    const textArea = document.createElement('textarea');
    textArea.style.opacity = '0';
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      // @ts-ignore
      document.execCommand('copy');
      console.log('Text copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
    } finally {
      document.body.removeChild(textArea);
    }
  } else {
    console.error('Copy to clipboard is not supported in this browser');
  }
};
