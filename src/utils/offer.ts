import { Hash } from 'viem';
import { PaymentOption } from '../shared/types.js';

/**
 * Returns payment option by Id
 *
 * @param {PaymentOption[]} options Payment options
 * @param {string} paymentId Payment option Id
 * @returns {PaymentOption} Payment option
 */
export const getPaymentOption = (
  options: PaymentOption[],
  paymentId: Hash,
): PaymentOption => {
  const option = options.find((o) => o.id === paymentId);

  if (!option) {
    throw new Error(`Payment option ${paymentId} not found`);
  }

  return option;
};
