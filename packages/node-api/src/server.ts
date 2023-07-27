import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { AnyRouter, TRPCError, initTRPC } from '@trpc/server';
import {
  CreateHTTPContextOptions,
  createHTTPHandler,
} from '@trpc/server/adapters/standalone';
import superjson from 'superjson';
import { SignJWT, jwtVerify } from 'jose';
import { Address } from 'viem';
import { Storage } from '@windingtree/sdk-storage';
import { User, UsersDb, DealsDb } from '@windingtree/sdk-db';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { ACCESS_TOKEN_NAME } from './constants.js';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('NodeApiServer');

/**
 * Type definition for the options to be passed when initializing the NodeApiServer.
 */
export interface NodeApiServerOptions {
  /**
   * An instance of the storage system that the API server will use for persisting users state.
   */
  usersStorage: Storage;

  /**
   * An instance of the storage system that the API server will use for persisting deals state.
   */
  dealsStorage?: Storage;

  /**
   * An instance of the protocol contracts manager.
   */
  protocolContracts?: ProtocolContracts;

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
 * The server API context type.
 * ApiContext is the context object passed to each tRPC procedure.
 * This object contains the current HTTP request, HTTP response,
 * an instance of UsersDb for user operations, and a function for updating user access tokens.
 * It may also contain a currently authenticated user.
 */
export interface ApiContext {
  req: IncomingMessage;
  res: ServerResponse;
  updateAccessToken: (user: User) => Promise<void>;
  ownerAccount?: Address;
  users: UsersDb;
  user?: User;
  deals?: DealsDb;
  contracts?: ProtocolContracts;
}

/**
 * Procedures metadata type
 */
export interface ApiMeta {
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
 * Initialization of tRPC with a context type of ApiContext.
 * Also specifies RouteMeta as the type for procedure metadata.
 */
export const trpc = initTRPC
  .context<ApiContext>()
  .meta<ApiMeta>()
  .create({
    transformer: superjson,
    defaultMeta: { authRequired: false },
  });

/**
 * Shortcut for defining routers with tRPC.
 */
export const router = trpc.router;

/**
 * Shortcut for defining mergeRouters utility.
 */
export const mergeRouters = trpc.mergeRouters;

/**
 * Shortcut for defining procedures with tRPC.
 */
export const procedure = trpc.procedure;

/**
 * Middleware for checking deals database existence in the context
 */
export const withDeals = trpc.middleware(async ({ next, ctx }) => {
  if (!ctx.deals) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  }

  return next({
    ctx: {
      deals: ctx.deals,
    },
  });
});

/**
 * Middleware for checking the protocol contracts manager existence in the context
 */
export const withContracts = trpc.middleware(async ({ next, ctx }) => {
  if (!ctx.contracts) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  }

  return next({
    ctx: {
      contracts: ctx.contracts,
    },
  });
});

/**
 * Middleware for checking the owner account configuration existence in the context
 */
export const withOwnerAccount = trpc.middleware(async ({ next, ctx }) => {
  if (!ctx.ownerAccount) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  }

  return next({
    ctx: {
      ownerAccount: ctx.ownerAccount,
    },
  });
});

/**
 * Middleware for checking user authorization
 */
export const isAuthorized = trpc.middleware(async ({ meta, next, ctx }) => {
  // only check authorization if enabled
  if (!ctx.user || (ctx.user && meta?.adminOnly && !ctx.user.isAdmin)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

/**
 * Helper for defining procedures that require user authentication.
 */
export const authProcedure = trpc.procedure.use(isAuthorized);

/**
 * Helper for defining procedures that require authentication of the user with admin rights.
 */
export const authAdminProcedure = trpc.procedure
  .use(isAuthorized)
  .meta({ adminOnly: true });

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
  private server?: ReturnType<typeof createServer>;
  /** An instance of the UsersDb class that manages user data */
  users: UsersDb;
  /** An instance of the DealsDb class that manages deals data */
  deals?: DealsDb;
  /** An instance of the ProtocolContracts that manages deals via the protocol smart contracts */
  protocolContracts?: ProtocolContracts;
  /** An Ethereum account address of the Node owner */
  ownerAccount?: Address;
  /** The duration (as a string or number) after which the access token will expire */
  expire: string | number;

  /**
   * Creates an instance of NodeApiServerOptions.
   *
   * @param {NodeApiServerOptions} options NodeApiServer initialization options
   * @memberof NodeApiServer
   */
  constructor(options: NodeApiServerOptions) {
    const {
      usersStorage,
      dealsStorage,
      protocolContracts,
      prefix,
      port,
      secret,
      ownerAccount,
      expire,
    } = options;

    // TODO Validate NodeApiServerOptions

    this.port = port;
    this.secret = secret;
    this.ownerAccount = ownerAccount;
    this.expire = expire ?? '1h';

    /** Initialize the UsersDb instance with the provided options */
    this.users = new UsersDb({ storage: usersStorage, prefix });

    if (dealsStorage) {
      /** Initialize the UsersDb instance with the provided options */
      this.deals = new DealsDb({ storage: dealsStorage, prefix });
    }

    if (protocolContracts) {
      this.protocolContracts = protocolContracts;
    }
  }

  /**
   * A method that creates the server context for each incoming request.
   * This context includes request and response objects, an instance of UsersDb, and
   * a method to update the access token.
   *
   * @private
   * @param {CreateHTTPContextOptions} { req, res } The incoming request and outgoing response
   * @returns {Promise<ApiContext>} A promise that resolves with the created context
   * @memberof NodeApiServer
   */
  private async createContext({
    req,
    res,
  }: CreateHTTPContextOptions): Promise<ApiContext> {
    /**
     * An utility function that creates a new JWT, updates the user record in the storage,
     * and sets the ACCESS_TOKEN header in the response.
     *
     * @internal
     *
     * @param {User} user The user for whom the access token is being updated
     */
    const updateAccessToken = async (user: User) => {
      // TODO Sign JWT with the protocol signer key instead of secret
      const jwt = new SignJWT({ login: user.login })
        .setProtectedHeader({
          alg: 'HS256',
        })
        .setIssuedAt()
        .setExpirationTime(this.expire);
      const accessToken = await jwt.sign(new TextEncoder().encode(this.secret));

      await this.users.set({
        ...user,
        jwt: accessToken,
      });
      logger.trace(`User ${user.login} accessToken updated`);

      // Set a custom ACCESS_TOKEN header
      res.setHeader(ACCESS_TOKEN_NAME, accessToken);
      res.setHeader(
        'Set-Cookie',
        `${ACCESS_TOKEN_NAME}=${accessToken}; expires=${new Date(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          Number(jwt['_payload'].exp!) * 1000,
        ).toUTCString()}; HttpOnly`,
      );
    };

    // Default API server context
    const ctx: ApiContext = {
      req,
      res,
      updateAccessToken,
      ownerAccount: this.ownerAccount,
      users: this.users,
      deals: this.deals,
      contracts: this.protocolContracts,
    };

    let accessToken: string | undefined;

    // Trying to extract the JWT from cookies
    // This method in priority
    if (req.headers.cookie) {
      const cookies = req.headers.cookie
        .split(';')
        .reduce<Record<string, string>>((a, v) => {
          const pair = v.split('=');
          return {
            ...a,
            [pair[0].toLowerCase()]: pair[1],
          };
        }, {});
      accessToken = cookies[ACCESS_TOKEN_NAME.toLocaleLowerCase()];
    }

    // Trying to extract the JWT from Authorization header
    // Using this method only if token not found in cookies
    if (!accessToken && req.headers.authorization) {
      accessToken = req.headers.authorization.split(' ')[1];
    }

    // Trying to verify the JWT if provided
    if (accessToken) {
      try {
        const secret = new TextEncoder().encode(this.secret);
        let verificationResult = await jwtVerify(
          // Extracting the token from the raw header: `Bearer <access_token>`
          accessToken,
          secret,
        );

        const { login } =
          verificationResult.payload as unknown as AccessTokenPayload;

        if (login) {
          const user = await this.users.get(login);

          // We must be sure that saved token is valid and not expired
          if (user?.jwt) {
            verificationResult = await jwtVerify(user.jwt, secret);
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
    // Create tRPC requests handler
    const handler = createHTTPHandler({
      router: appRouter,
      createContext: this.createContext.bind(this),
    });

    // Create a http server for handling of HTTP requests
    // TODO Implement origin configuration via .env
    this.server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5174');
      res.setHeader('Access-Control-Request-Method', 'GET');
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      handler(req, res).catch((error) => logger.error(error));
    });

    // Start the HTTP server on the specified port
    this.server.listen(this.port);
    logger.trace(
      `🚀 tRPC API server started on the port: ${this.port} at:`,
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
        this.server.close((error) => {
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
