import { Hash, Address, keccak256, encodePacked } from 'viem';

/**
 * Generates supplier Id (bytes32 string)
 *
 * @param {string} salt
 * @param {Address} address
 * @returns {Hash}
 */
export const supplierId = (salt: Hash, address: Address): Hash =>
  keccak256(encodePacked(['bytes32', 'address'], [salt, address]));
