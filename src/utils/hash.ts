/* eslint-disable @typescript-eslint/no-unsafe-return */
import { solidityPackedKeccak256 } from 'ethers';
import { PaymentOption, CancelOption, UnsignedOfferPayload } from '../shared/types.js';
import {
  PAYMENT_OPTION_TYPE_HASH,
  CANCEL_OPTION_TYPE_HASH,
  OFFER_TYPE_HASH,
} from '@windingtree/contracts';

/**
 * Converts an object that contains bigint value to a JSON string representation.
 *
 * @param {unknown} data The data to stringify.
 * @returns {string} The JSON string representation of the data.
 */
export const stringify = (data: unknown): string => {
  return JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
};

/**
 * Computes the keccak256 hash of an object.
 *
 * @param {unknown} data The data object to hash.
 * @returns {string} The keccak256 hash of the data.
 */
export const hashObject = (data: unknown): string => {
  return solidityPackedKeccak256(['string'], [stringify(data)]);
};

/**
 * Computes the keccak256 hash of a PaymentOption object.
 *
 * @param {PaymentOption} option The PaymentOption object to hash.
 * @returns {string} The keccak256 hash of the PaymentOption.
 */
export const hashPaymentOption = (option: PaymentOption): string => {
  return solidityPackedKeccak256(
    ['bytes32', 'bytes32', 'uint256', 'address'],
    [PAYMENT_OPTION_TYPE_HASH, option.id, option.price, option.asset],
  );
};

/**
 * Computes the keccak256 hash of a CancelOption object.
 *
 * @param {CancelOption} option The CancelOption object to hash.
 * @returns {string} The keccak256 hash of the CancelOption.
 */
export const hashCancelOption = (option: CancelOption): string => {
  return solidityPackedKeccak256(
    ['bytes32', 'uint256', 'uint256'],
    [CANCEL_OPTION_TYPE_HASH, option.time, option.penalty],
  );
};

/**
 * Computes the keccak256 hash of an array of PaymentOption objects.
 *
 * @param {PaymentOption[]} options The array of PaymentOption objects to hash.
 * @returns {string} The keccak256 hash of the PaymentOption array.
 */
export const hashPaymentOptionArray = (options: PaymentOption[]): string => {
  const hashes = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashPaymentOption(options[i]);
  }

  return solidityPackedKeccak256(['bytes32[]'], [hashes]);
};

/**
 * Computes the keccak256 hash of an array of CancelOption objects.
 *
 * @param {CancelOption[]} options The array of CancelOption objects to hash.
 * @returns {string} The keccak256 hash of the CancelOption array.
 */
export const hashCancelOptionArray = (options: CancelOption[]): string => {
  const hashes = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashCancelOption(options[i]);
  }

  return solidityPackedKeccak256(['bytes32[]'], [hashes]);
};

/**
 * Computes the keccak256 hash of an UnsignedOfferPayload object.
 *
 * @param {UnsignedOfferPayload} payload The UnsignedOfferPayload object to hash.
 * @returns {string} The keccak256 hash of the UnsignedOfferPayload.
 */
export const hashOfferPayload = (payload: UnsignedOfferPayload): string => {
  return solidityPackedKeccak256(
    [
      'bytes32',
      'bytes32',
      'uint256',
      'bytes32',
      'uint256',
      'bytes32',
      'bytes32',
      'bytes32',
      'bytes32',
      'bool',
      'uint256',
    ],
    [
      OFFER_TYPE_HASH,
      payload.id,
      payload.expire,
      payload.supplierId,
      payload.chainId,
      payload.requestHash,
      payload.optionsHash,
      payload.paymentHash,
      payload.cancelHash,
      payload.transferable,
      payload.checkIn,
    ],
  );
};

/**
 * Computes the keccak256 hash of a CheckInOut voucher.
 *
 * @param {string} offerId The ID of the offer.
 * @param {string} signer The signer's address.
 * @returns {string} The keccak256 hash of the CheckInOut operation.
 */
export const hashCheckInOut = (offerId: string, signer: string): string => {
  return solidityPackedKeccak256(
    ['bytes32', 'bytes32', 'address'],
    [OFFER_TYPE_HASH, offerId, signer],
  );
};
