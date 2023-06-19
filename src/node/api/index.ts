import { IncomingMessage, ServerResponse } from 'http';
import { z, ZodTypeAny } from 'zod';
import { ProcedureRouterRecord, initTRPC } from '@trpc/server';
import {
  CreateHTTPContextOptions,
  createHTTPServer,
} from '@trpc/server/adapters/standalone';
import * as jwt from 'jsonwebtoken';
import { Storage } from '../../storage/index.js';
import { UserInputSchema, User, UsersDb } from './db.js';

export interface APIContext {
  login?: string;
  req: IncomingMessage;
  res: ServerResponse;
}

/**
 * API server initialization options type
 */
export interface NodeApiServerOptions {
  /** Instance of storage used for persisting the state of the API server */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
  /** NodeApiServer HTTP port */
  port: number;
  /** Passwords hashing salt */
  salt: string;
  /** App secret */
  secret: string;
  /** Access token expiration time */
  expire?: string | number;
}

export class NodeApiServer {
  /** Storage instance for persisting the state of the API server */
  private storage: Storage;
  /** Specific key prefix for the storage key to avoid potential key collisions */
  private prefix: string;
  /** NodeApiServer HTTP port */
  private port: number;
  /** Users storage instance */
  private users: UsersDb;
  /** App secret */
  private secret: string;
  /** Access token expiration time */
  expire: string | number;
  /** tRPC builder */
  private trpc;
  /** HTTP server */
  private server?: ReturnType<typeof createHTTPServer>;
  /** tRPC router records */
  private routes: ProcedureRouterRecord; //Record<string, AnyProcedure>;

  /**
   * Creates an instance of NodeApiServerOptions.
   *
   * @param {NodeApiServerOptions} options
   * @memberof NodeApiServer
   */
  constructor(options: NodeApiServerOptions) {
    const { storage, prefix, port, salt, secret, expire } = options;

    // @todo Validate NodeApiServerOptions

    this.prefix = `${prefix}_api_`;
    this.storage = storage;
    this.port = port;
    this.secret = secret;
    this.expire = expire ?? '1h';
    this.users = new UsersDb({ storage, prefix, salt });
    this.trpc = initTRPC.context<APIContext>().create();
    this.routes = {};
    this.userRegisterRoute();
    this.userLoginRoute();
  }

  private async updateAccessToken(user: User, res: ServerResponse) {
    const accessToken = jwt.sign({ login: user.login }, this.secret, {
      expiresIn: this.expire,
    });

    await this.users.set({
      ...user,
      jwt: accessToken,
    });

    // Set ACCESS_TOKEN HTTP-only cookie
    res.setHeader('Set-Cookie', `jwt=${accessToken}; HttpOnly`);
  }

  private async createContext({ req, res }: CreateHTTPContextOptions) {
    const ctx: APIContext = {
      req,
      res,
    };

    if (req.headers.authorization) {
      const { login } = jwt.verify(
        req.headers.authorization.split(' ')[1],
        this.secret,
      ) as APIContext;

      if (login) {
        const user = await this.users.get(login);

        if (user) {
          await this.updateAccessToken(user, ctx.res);
          ctx.login = login;
        }
      }
    }

    return ctx;
  }

  private userRegisterRoute() {
    this.addMutation(
      'user.register',
      async ({ input }) => {
        const { login, password } = input as unknown as z.infer<
          typeof UserInputSchema
        >;
        await this.users.add(login, password);
      },
      UserInputSchema,
    );
  }

  private userLoginRoute() {
    this.addMutation(
      'user.login',
      async ({ input, ctx }) => {
        const { login, password } = input as unknown as z.infer<
          typeof UserInputSchema
        >;

        const user = await this.users.get(login);

        if (user.login !== UsersDb.hashPassword(password, this.users.salt)) {
          throw new Error('Invalid login or password');
        }

        await this.updateAccessToken(user, ctx.res);
      },
      UserInputSchema,
    );
  }

  addQuery(
    name: string,
    resolver: Parameters<typeof this.trpc.procedure.query>[0],
    inputSchema: ZodTypeAny,
  ) {
    this.routes = {
      ...this.routes,
      [name]: this.trpc.procedure.input(inputSchema).query(resolver),
    };
  }

  addMutation(
    name: string,
    resolver: Parameters<typeof this.trpc.procedure.mutation>[0],
    inputSchema: ZodTypeAny,
  ) {
    this.routes = {
      ...this.routes,
      [name]: this.trpc.procedure.input(inputSchema).mutation(resolver),
    };
  }

  addSubscription(
    name: string,
    resolver: Parameters<typeof this.trpc.procedure.subscription>[0],
    inputSchema: ZodTypeAny,
  ) {
    this.routes = {
      ...this.routes,
      [name]: this.trpc.procedure.input(inputSchema).subscription(resolver),
    };
  }

  start() {
    this.server = createHTTPServer({
      router: this.trpc.router(this.routes),
      createContext: this.createContext.bind(this),
    });
    this.server.listen(this.port);
  }

  async stop() {
    await new Promise<void>((resolve, reject) => {
      if (this.server) {
        this.server.server.close((error) => {
          if (error) {
            return reject(error);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
