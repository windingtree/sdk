import { TRPCError } from '@trpc/server';
import { User, UserInputSchema, comparePassword } from '../../db/users.js';
import {
  APIContext,
  router,
  procedure,
  authProcedure,
  authAdminProcedure,
} from '../index.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('UserRouter');

/**
 * A router defining procedures for user management.
 */
export const userRouter = router({
  /**
   * Register a new user.
   * Throws an error if the user already exists.
   */
  register: authAdminProcedure
    .input(UserInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { login, password } = input;
      const { server } = ctx;
      try {
        await server.users.add(login, password);
        logger.trace(`User ${login} registered`);
      } catch (error) {
        logger.error('user.register', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Log in an existing user.
   * If successful, generates a new access token and sends it in the response.
   */
  login: procedure.input(UserInputSchema).mutation(async ({ input, ctx }) => {
    const { login, password } = input;
    const { server, updateAccessToken } = ctx;
    let user: User;

    try {
      logger.trace(`Trying to log in user ${login}`);
      user = await server.users.get(login);
    } catch (error) {
      logger.error('user.login', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: (error as Error).message,
      });
    }

    const isValidPassword = await comparePassword(
      password,
      user.hashedPassword,
    );

    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid login or password',
      });
    }

    await updateAccessToken(user);
  }),

  /**
   * Log out the user.
   * Removes a saved JWT from the user record in the storage.
   */
  logout: authProcedure
    .input(UserInputSchema.pick({ login: true }))
    .mutation(async ({ ctx }) => {
      const { user, server } = ctx as Required<APIContext>;

      try {
        delete user.jwt;
        await server.users.set(user);
        logger.trace(`User ${user.login} logged out`);
      } catch (error) {
        logger.error('user.logout', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Deletes the user (self deletion).
   * User must be logged in to be able to delete his record.
   */
  delete: authProcedure.mutation(async ({ ctx }) => {
    const { user, server } = ctx as Required<APIContext>;

    try {
      await server.users.delete(user.login);
      logger.trace(`User ${user.login} deleted`);
    } catch (error) {
      logger.error('user.delete', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: (error as Error).message,
      });
    }
  }),
});
