import { TRPCError } from '@trpc/server';
import { User, UserInputSchema, comparePassword } from '@windingtree/sdk-db';
import {
  router,
  procedure,
  authProcedure,
  authAdminProcedure,
} from '../server.js';
import { ACCESS_TOKEN_NAME } from '../constants.js';
import { createLogger } from '@windingtree/sdk-logger';

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
      try {
        const { login, password } = input;
        const { users } = ctx;
        await users.add(login, password);
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
    const { users, updateAccessToken } = ctx;
    let user: User;

    try {
      logger.trace(`Trying to log in user ${login}`);
      user = await users.get(login);
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
  logout: authProcedure.mutation(async ({ ctx }) => {
    try {
      const { user, users, res } = ctx;
      delete user.jwt;
      await users.set(user);
      res.setHeader(
        'Set-Cookie',
        `${ACCESS_TOKEN_NAME}=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`,
      );
      logger.trace(`User ${user.login} logged out`);
      /* c8 ignore next 7 */
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
    try {
      const { user, users, res } = ctx;
      await users.delete(user.login);
      res.setHeader(
        'Set-Cookie',
        `${ACCESS_TOKEN_NAME}=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`,
      );
      logger.trace(`User ${user.login} deleted`);
      /* c8 ignore next 7 */
    } catch (error) {
      logger.error('user.delete', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: (error as Error).message,
      });
    }
  }),

  /**
   * Updates authenticated user
   */
  update: authProcedure
    .input(
      UserInputSchema.omit({
        login: true,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { password } = input;
        const { user, users } = ctx;
        await users.set(user, password);
        logger.trace(`User ${user.login} updated`);
        /* c8 ignore next 7 */
      } catch (error) {
        logger.error('users.update', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),
});
