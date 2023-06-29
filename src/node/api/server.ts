import { IncomingMessage, ServerResponse } from 'http';
import { AnyRouter, TRPCError, initTRPC } from '@trpc/server';
import { tap } from '@trpc/server/observable';
import { TRPCLink } from '@trpc/client';
import {
  CreateHTTPContextOptions,
  createHTTPServer,
} from '@trpc/server/adapters/standalone';
import * as jwt from 'jsonwebtoken';
import { Address } from 'viem';
import { Storage } from '../../storage/index.js';
import { User, UsersDb } from './db.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('NodeApiServer');

/**
 * The server API context type.
 * APIContext is the context object passed to each tRPC procedure.
 * This object contains the current HTTP request, HTTP response,
 * an instance of UsersDb for user operations, and a function for updating user access tokens.
 * It may also contain a currently authenticated user.
 */
export interface APIContext {
  req: IncomingMessage;
  res: ServerResponse;
  server: NodeApiServer;
  updateAccessToken: (user: User) => Promise<void>;
  user?: User;
}

/**
 * Procedures metadata type
 */
export interface RouteMeta {
  /** An option that specifies that the route must be authorized */
  authRequired?: boolean;
  /** An option that specifies that only users with administrative privileges are allowed */
  adminOnly?: boolean;
}

/**
 * Payload for the access token
 */
export interface AccessTokenPayload {
  login: string;
}

/**
 * Name of the access token, used as a key when storing in the server response header
 */
export const ACCESS_TOKEN_NAME = 'ACCESS_TOKEN';

/**
 * Initialization of tRPC with a context type of APIContext.
 * Also specifies RouteMeta as the type for procedure metadata.
 */
export const trpc = initTRPC
  .context<APIContext>()
  .meta<RouteMeta>()
  .create({
    defaultMeta: { authRequired: false },
  });

/**
 * Shortcut for defining routers with tRPC.
 */
export const router = trpc.router;

/**
 * Shortcut for defining procedures with tRPC.
 */
export const procedure = trpc.procedure;

/**
 * Middleware for checking user authorization.
 * If authRequired is true and there is no user in the context, it throws an UNAUTHORIZED error.
 */
export const isAuthorized = trpc.middleware(async ({ meta, next, ctx }) => {
  // only check authorization if enabled
  if (
    (meta?.authRequired && !ctx.user) ||
    (meta?.authRequired && ctx.user && meta.adminOnly && !ctx.user.isAdmin)
  ) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next();
});

/**
 * Helper for defining procedures that require user authentication.
 */
export const authProcedure = trpc.procedure
  .use(isAuthorized)
  .meta({ authRequired: true });

/**
 * Helper for defining procedures that require authentication of the user with admin rights.
 */
export const authAdminProcedure = trpc.procedure
  .use(isAuthorized)
  .meta({ authRequired: true, adminOnly: true });

/**
 * Type definition for the options to be passed when initializing the NodeApiServer.
 */
export interface NodeApiServerOptions {
  /**
   * An instance of the storage system that the API server will use for persisting its state.
   * This could be a database, file storage, or any other form of data persistence.
   */
  storage: Storage;

  /**
   * A string that will be prepended to the keys used in the storage system. This is to prevent
   * possible conflicts with other keys in the same storage.
   */
  prefix: string;

  /**
   * The port number on which the NodeApiServer will be listening for HTTP requests.
   */
  port: number;

  /**
   * A secret string used by the application for various purposes, often for signing and verifying tokens.
   */
  secret: string;

  /**
   * An Ethereum account address of the Node owner
   */
  ownerAccount?: Address;

  /**
   * The duration (as a string or number) after which the access token will expire.
   * If not provided, some default value or policy might be used.
   */
  expire?: string | number;
}

/**
 * The NodeApiServer class, which implements a tRPC API for the protocol Node.
 *
 * @export
 * @class NodeApiServer
 */
export class NodeApiServer {
  /** The HTTP port that the NodeApiServer listens on */
  private port: number;
  /** The secret string used by the application for signing and verifying tokens */
  private secret: string;
  /** An instance of the HTTP server created by the `createHTTPServer` function */
  private server?: ReturnType<typeof createHTTPServer>;
  /** An instance of the UsersDb class that manages user data */
  users: UsersDb;
  /** An Ethereum account address of the Node owner */
  ownerAccount?: Address;
  /** The duration (as a string or number) after which the access token will expire */
  expire: string | number;

  /**
   * Creates an instance of NodeApiServerOptions.
   *
   * @param {NodeApiServerOptions} options
   * @memberof NodeApiServer
   */
  constructor(options: NodeApiServerOptions) {
    const { storage, prefix, port, secret, ownerAccount, expire } = options;

    // TODO Validate NodeApiServerOptions

    this.port = port;
    this.secret = secret;
    this.ownerAccount = ownerAccount;
    this.expire = expire ?? '1h';

    /** Initialize the UsersDb instance with the provided options */
    this.users = new UsersDb({ storage, prefix });
  }

  /**
   * A method that creates the server context for each incoming request.
   * This context includes request and response objects, an instance of UsersDb, and
   * a method to update the access token.
   *
   * @private
   * @param {CreateHTTPContextOptions} { req, res } The incoming request and outgoing response
   * @returns {Promise<APIContext>} A promise that resolves with the created context
   * @memberof NodeApiServer
   */
  private async createContext({
    req,
    res,
  }: CreateHTTPContextOptions): Promise<APIContext> {
    /**
     * An utility function that creates a new JWT, updates the user record in the storage,
     * and sets the ACCESS_TOKEN header in the response.
     *
     * @internal
     *
     * @param {User} user The user for whom the access token is being updated
     */
    const updateAccessToken = async (user: User) => {
      const accessToken = jwt.sign({ login: user.login }, this.secret, {
        expiresIn: this.expire,
      });

      await this.users.set({
        ...user,
        jwt: accessToken,
      });
      logger.trace(`User ${user.login} accessToken updated`);

      // Set a custom ACCESS_TOKEN header
      res.setHeader(ACCESS_TOKEN_NAME, accessToken);
    };

    // Default API server context
    const ctx: APIContext = {
      req,
      res,
      server: this,
      updateAccessToken,
    };

    // Trying to verify the JWT if provided by the client
    if (req.headers.authorization) {
      try {
        const { login } = jwt.verify(
          // Extracting the token from the raw header: `Bearer <access_token>`
          req.headers.authorization.split(' ')[1],
          this.secret,
        ) as AccessTokenPayload;

        if (login) {
          const user = await this.users.get(login);

          // We must be sure that saved token is valid and not expired
          if (user && user.jwt && jwt.verify(user.jwt, this.secret)) {
            await updateAccessToken(user);
            ctx.user = user;
          }
        }
      } catch (error) {
        logger.error('createContext', error);
      }
    }

    return ctx;
  }

  /**
   * Starts the API server
   *
   * @param {AnyRouter} appRouter The tRPC router to be used by the server
   * @memberof NodeApiServer
   */
  start(appRouter: AnyRouter) {
    // Create a tRPC server with the provided router and context
    this.server = createHTTPServer<AnyRouter>({
      router: appRouter,
      createContext: this.createContext.bind(this),
    });

    // Start the HTTP server on the specified port
    this.server.listen(this.port);
    logger.trace(
      `🚀 API server started on the port: ${this.port} at:`,
      new Date().toISOString(),
    );
  }

  /**
   * Stops the API server
   *
   * @memberof NodeApiServer
   */
  async stop() {
    await new Promise<void>((resolve, reject) => {
      // Close the HTTP server if it's running
      if (this.server) {
        this.server.server.close((error) => {
          if (error) {
            logger.error('stop', error);
            return reject(error);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
    logger.trace('👋 API server stopped at:', new Date().toISOString());
  }
}

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
    // Continue to the next link in the chain and apply a tap operator to the result.
    return next(op).pipe(
      tap({
        next: (result) => {
          // TODO The following code must be somehow refactored and improved
          // Check if context is available on the result.
          if (result.context) {
            // Find the 'headers' symbol on the response object.
            const headersKey = Object.getOwnPropertySymbols(
              result.context.response,
            ).find((s) => s.description === 'headers');

            if (headersKey) {
              // Extract headers from the response using the 'headers' symbol.
              const headers = (result.context.response as never)[headersKey];

              // Find the 'headers list' symbol on the headers object.
              const headersListKey = Object.getOwnPropertySymbols(headers).find(
                (s) => s.description === 'headers list',
              );

              if (headersListKey) {
                // Extract headers list from the headers using the 'headers list' symbol.
                const headersList = headers[headersListKey];

                // Find the 'headers map' symbol on the headers list object.
                const headersMapKey = Object.getOwnPropertySymbols(
                  headersList,
                ).find((s) => s.description === 'headers map');

                if (headersMapKey) {
                  // Extract headers map from the headers list using the 'headers map' symbol.
                  const headersMap = headersList[headersMapKey] as Map<
                    string,
                    Record<string, string>
                  >;

                  if (headersMap instanceof Map) {
                    // Look for the access token in the headers map.
                    const record = headersMap.get(
                      tokenName.toLocaleLowerCase(),
                    );

                    if (record) {
                      // If the access token is found, invoke the callback function with the access token.
                      onAccessToken(record.value);
                      logger.trace('Access token found in the request headers');
                    }
                  }
                }
              }
            }
          }
        },
      }),
    );
  };
