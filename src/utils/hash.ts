import { Hash, Address, keccak256, concat, toHex, stringify } from 'viem';
import { PaymentOption, CancelOption, UnsignedOfferPayload } from '../shared/types.js';
import {
  PAYMENT_OPTION_TYPE_HASH,
  CANCEL_OPTION_TYPE_HASH,
  OFFER_TYPE_HASH,
} from '@windingtree/contracts';

/**
 * Converts an object that contains bigint values to a JSON string representation.
 *
 * @param {unknown} data The data to stringify.
 * @returns {string} The JSON string representation of the data.
 */
export { stringify };

/**
 * Computes the keccak256 hash of an object.
 *
 * @param {unknown} data The data object to hash.
 * @returns {Hash} The keccak256 hash of the data.
 */
export const hashObject = (data: unknown): Hash => {
  return keccak256(toHex(stringify(data)));
};

/**
 * Computes the keccak256 hash of a PaymentOption object.
 *
 * @param {PaymentOption} option The PaymentOption object to hash.
 * @returns {Hash} The keccak256 hash of the PaymentOption.
 */
export const hashPaymentOption = (option: PaymentOption): Hash => {
  // ['bytes32', 'bytes32', 'uint256', 'address']
  return keccak256(
    concat([PAYMENT_OPTION_TYPE_HASH, option.id, toHex(option.price), option.asset]),
  );
};

/**
 * Computes the keccak256 hash of a CancelOption object.
 *
 * @param {CancelOption} option The CancelOption object to hash.
 * @returns {Hash} The keccak256 hash of the CancelOption.
 */
export const hashCancelOption = (option: CancelOption): Hash => {
  // ['bytes32', 'uint256', 'uint256']
  return keccak256(concat([CANCEL_OPTION_TYPE_HASH, toHex(option.time), toHex(option.penalty)]));
};

/**
 * Computes the keccak256 hash of an array of PaymentOption objects.
 *
 * @param {PaymentOption[]} options The array of PaymentOption objects to hash.
 * @returns {Hash} The keccak256 hash of the PaymentOption array.
 */
export const hashPaymentOptionArray = (options: PaymentOption[]): Hash => {
  const hashes: Hash[] = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashPaymentOption(options[i]);
  }

  return keccak256(concat(hashes));
};

/**
 * Computes the keccak256 hash of an array of CancelOption objects.
 *
 * @param {CancelOption[]} options The array of CancelOption objects to hash.
 * @returns {Hash} The keccak256 hash of the CancelOption array.
 */
export const hashCancelOptionArray = (options: CancelOption[]): Hash => {
  const hashes: Hash[] = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashCancelOption(options[i]);
  }

  return keccak256(concat(hashes));
};

/**
 * Computes the keccak256 hash of an UnsignedOfferPayload object.
 *
 * @param {UnsignedOfferPayload} payload The UnsignedOfferPayload object to hash.
 * @returns {Hash} The keccak256 hash of the UnsignedOfferPayload.
 */
export const hashOfferPayload = (payload: UnsignedOfferPayload): Hash => {
  // [
  //   'bytes32',
  //   'bytes32',
  //   'uint256',
  //   'bytes32',
  //   'uint256',
  //   'bytes32',
  //   'bytes32',
  //   'bytes32',
  //   'bytes32',
  //   'bool',
  //   'uint256',
  // ]
  return keccak256(
    concat([
      OFFER_TYPE_HASH,
      payload.id,
      toHex(payload.expire),
      payload.supplierId,
      toHex(payload.chainId),
      payload.requestHash,
      payload.optionsHash,
      payload.paymentHash,
      payload.cancelHash,
      toHex(payload.transferable),
      toHex(payload.checkIn),
    ]),
  );
};

/**
 * Computes the keccak256 hash of a CheckInOut voucher.
 *
 * @param {string} offerId The ID of the offer.
 * @param {string} signer The signer's address.
 * @returns {Hash} The keccak256 hash of the CheckInOut operation.
 */
export const hashCheckInOut = (offerId: Hash, signer: Address): Hash => {
  // ['bytes32', 'bytes32', 'address']
  return keccak256(concat([OFFER_TYPE_HASH, offerId, signer]));
};
