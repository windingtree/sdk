import { Hash, Address, keccak256, encodePacked } from 'viem';

/**
 * Generates supplier Id (bytes32 string)
 *
 * @param {Address} address
 * @param {string} salt
 * @returns {Hash}
 */
export const supplierId = (address: Address, salt: Hash): Hash =>
  keccak256(encodePacked(['address', 'bytes32'], [address, salt]));
