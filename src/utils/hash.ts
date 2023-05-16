/* eslint-disable @typescript-eslint/no-unsafe-return */
import { solidityPackedKeccak256 } from 'ethers';
import { PaymentOption, CancelOption, UnsignedOfferPayload } from '../shared/types.js';
import {
  PAYMENT_OPTION_TYPE_HASH,
  CANCEL_OPTION_TYPE_HASH,
  OFFER_TYPE_HASH,
} from '@windingtree/contracts';

export const stringify = (data: unknown): string =>
  JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

export const hashObject = (data: unknown): string =>
  solidityPackedKeccak256(['string'], [stringify(data)]);

export const hashPaymentOption = (option: PaymentOption): string =>
  solidityPackedKeccak256(
    ['bytes32', 'bytes32', 'uint256', 'address'],
    [PAYMENT_OPTION_TYPE_HASH, option.id, option.price, option.asset],
  );

export const hashCancelOption = (option: CancelOption): string =>
  solidityPackedKeccak256(
    ['bytes32', 'uint256', 'uint256'],
    [CANCEL_OPTION_TYPE_HASH, option.time, option.penalty],
  );

export const hashPaymentOptionArray = (options: PaymentOption[]): string => {
  const hashes = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashPaymentOption(options[i]);
  }
  return solidityPackedKeccak256(['bytes32[]'], [hashes]);
};

export const hashCancelOptionArray = (options: CancelOption[]): string => {
  const hashes = [];

  for (let i = 0; i < options.length; i++) {
    hashes[i] = hashCancelOption(options[i]);
  }

  return solidityPackedKeccak256(['bytes32[]'], [hashes]);
};

export const hashOfferPayload = (payload: UnsignedOfferPayload): string =>
  solidityPackedKeccak256(
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

export const hashCheckInOut = (offerId: string, signer: string): string =>
  solidityPackedKeccak256(['bytes32', 'bytes32', 'address'], [OFFER_TYPE_HASH, offerId, signer]);
