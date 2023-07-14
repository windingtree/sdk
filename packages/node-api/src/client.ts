import { AnyRouter } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { TRPCLink } from '@trpc/client';
import { Address, Hash, WalletClient } from 'viem';
import { adminDomain, adminAuthEip712Types } from './constants.js';
import { Account } from '@windingtree/sdk-messages';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('NodeApiClient');

/**
 * Create EIP-712 signature for checkIn/Out voucher
 *
 * @param {Account} account Ethereum local account
 * @returns {Promise<Hash>}
 */
export const createAdminSignature = async (
  account: Account | WalletClient,
): Promise<Hash> => {
  let address: Address;

  if ((account as Account).address) {
    address = (account as Account).address;
  } else if (typeof (account as WalletClient).getAddresses === 'function') {
    [address] = await (account as WalletClient).getAddresses();
  } else {
    throw new Error('Unable to get signer address');
  }

  return await account.signTypedData({
    account: address,
    domain: adminDomain,
    types: adminAuthEip712Types,
    primaryType: 'Admin',
    message: {
      signer: address,
    },
  });
};

/**
 * tRPC link function that watches for UNAUTHORIZED server responses.
 *
 * @param {(t) => void} onUnauthorized Callback function to be invoked when an server sends UNAUTHORIZED error.
 * @returns {TRPCLink<AnyRouter>} Returns a TRPCLink function compatible with tRPC middleware chains.
 */
export const unauthorizedLink =
  (onUnauthorized: () => void): TRPCLink<AnyRouter> =>
  () =>
  ({ op, next }) => {
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next(value) {
          observer.next(value);
        },
        error(err) {
          logger.error('unauthorizedLink', err);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (err?.data?.httpStatus === 401) {
            onUnauthorized();
          }

          observer.error(err);
        },
        complete() {
          observer.complete();
        },
      });
      return unsubscribe;
    });
  };

/**
 * tRPC link function that extracts an access token from the server response context.
 * This function is designed to operate in a tRPC middleware chain and specifically handle
 * operations related to access token extraction and handling.
 *
 * @param {string} tokenName Access token name
 * @param {(token: string) => void} onAccessToken Callback function to be invoked when an access token is found.
 * @returns {TRPCLink<AnyRouter>} Returns a TRPCLink function compatible with tRPC middleware chains.
 */
export const accessTokenLink =
  (
    tokenName: string,
    onAccessToken: (token: string) => void,
  ): TRPCLink<AnyRouter> =>
  () =>
  ({ op, next }) => {
    logger.trace('request', op);

    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next(value) {
          logger.trace('response', value);

          // Extract access token from the response
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-explicit-any
          const token = (value?.context?.response as any)?.headers?.get(
            tokenName,
          ) as string;

          if (token) {
            logger.trace('token', token);
            onAccessToken(token);
          }

          observer.next(value);
        },
        error(err) {
          logger.error(err);
          observer.error(err);
        },
        complete() {
          observer.complete();
        },
      });
      return unsubscribe;
    });
  };

/**
 * Re-export of constants
 */
export * from './constants.js';
