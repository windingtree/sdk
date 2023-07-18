import { TRPCError } from '@trpc/server';
import { Address, Hash, verifyTypedData } from 'viem';
import { adminDomain, adminAuthEip712Types } from '../constants.js';
import { User, UserInputSchema } from '@windingtree/sdk-db';
import { router, procedure, withOwnerAccount } from '../server.js';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('AdminRouter');

/**
 * Verification of the admins signature
 *
 * @param {Address} signer The address of admin account
 * @param {Hash} signature Admins EIP-712 signature
 * @returns {Promise<boolean>}
 */
export const verifyAdminSignature = async (
  signer: Address,
  signature: Hash,
): Promise<boolean> =>
  await verifyTypedData({
    address: signer,
    domain: adminDomain,
    types: adminAuthEip712Types,
    primaryType: 'Admin',
    message: {
      signer,
    },
    signature,
  });

/**
 * A router defining procedures for admin management.
 */
export const adminRouter = router({
  /**
   * Register a new admin.
   * Throws an error if the user already exists or signature provided is invalid.
   */
  register: procedure
    .use(withOwnerAccount)
    .input(UserInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { login, password } = input;
      const { ownerAccount, users, updateAccessToken } = ctx;

      try {
        if (!(await verifyAdminSignature(ownerAccount, password as Hash))) {
          throw new Error('Invalid signature');
        }

        await users.add(login, password, true);
        logger.trace(`Admin registered`);

        // Automatically login the user after the registration
        await updateAccessToken(await users.get(login));
      } catch (error) {
        logger.error('admin.register', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Log in an existing admin.
   * If successful, generates a new access token and sends it in the response.
   */
  login: procedure
    .use(withOwnerAccount)
    .input(UserInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { login, password } = input;
      const { ownerAccount, users, updateAccessToken } = ctx;
      let user: User;

      try {
        logger.trace(`Trying to log in admin ${login}`);
        user = await users.get(login);
      } catch (error) {
        logger.error('admin.login', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }

      if (!(await verifyAdminSignature(ownerAccount, password as Hash))) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid signature',
        });
      }

      await updateAccessToken(user);
    }),
});
