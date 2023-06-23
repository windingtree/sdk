import { describe, beforeAll, afterAll, it, expect } from './setup.js';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { UserInputType } from '../src/node/api/db.js';
import {
  NodeApiServer,
  NodeApiServerOptions,
  ACCESS_TOKEN_NAME,
  userRouter,
  router,
  accessTokenLink,
  authProcedure,
} from '../src/node/api/index.js';
import { createInitializer } from '../src/storage/memory.js';

const appRouter = router({
  user: userRouter,
  testAuth: authProcedure.output(z.boolean()).mutation(() => {
    return true;
  }),
});

describe('NodeApiServer', () => {
  const user: UserInputType = {
    login: 'testUser',
    password: 'password',
  };
  let options: NodeApiServerOptions;
  let server: NodeApiServer;
  let client: ReturnType<typeof createTRPCProxyClient<typeof appRouter>>;
  let accessToken: string | undefined;

  beforeAll(async () => {
    options = {
      storage: await createInitializer()(),
      prefix: 'test',
      salt: 'salt',
      port: 3456,
      secret: 'secret',
    };
    server = new NodeApiServer(options);

    server.start(appRouter);

    client = createTRPCProxyClient<typeof appRouter>({
      links: [
        accessTokenLink(ACCESS_TOKEN_NAME, (token) => {
          accessToken = token;
        }),
        httpBatchLink({
          url: `http://localhost:${options.port}`,
          headers: () => ({
            authorization: accessToken ? `Bearer ${accessToken}` : '',
          }),
        }),
      ],
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('user.register', () => {
    it('should register a new user', async () => {
      const result = await client.user.register.mutate(user);
      expect(result).to.be.eq(undefined);
    });

    it('should throw an error when trying to register an existing user', async () => {
      await expect(client.user.register.mutate(user)).rejects.toThrow(
        `User ${user.login} already exists`,
      );
    });
  });

  describe('user.login', () => {
    it('should log in a registered user and return an access token', async () => {
      const result = await client.user.login.mutate(user);
      expect(result).to.be.eq(undefined);
      expect(accessToken).toBeDefined();
    });

    it('should throw an error when trying to log in with incorrect password', async () => {
      await expect(
        client.user.login.mutate({
          ...user,
          password: 'invalid-password',
        }),
      ).rejects.toThrow('Invalid login or password');
    });
  });

  describe('user.logout', () => {
    it('should logout a logged in user', async () => {
      const result = await client.user.logout.mutate(user);
      expect(result).to.be.eq(undefined);
      expect(accessToken).toBeDefined();
    });

    it('should throw an error when trying to access authenticated route', async () => {
      await expect(client.testAuth.mutate()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('user.delete', () => {
    let newUser: UserInputType;

    beforeAll(() => {
      newUser = {
        ...user,
        login: 'new-user',
      };
    });

    it('should throw if called by non authorized user', async () => {
      await expect(client.user.delete.mutate()).rejects.toThrow('UNAUTHORIZED');
    });

    it('should delete existed user', async () => {
      await client.user.register.mutate(newUser);
      await client.user.login.mutate(newUser);
      const result = await client.user.delete.mutate();
      expect(result).to.be.eq(undefined);
      accessToken = undefined;
    });

    it('should throw on try to login with deleted user ', async () => {
      await expect(client.user.login.mutate(newUser)).rejects.toThrow(
        'User new-user not found',
      );
    });
  });

  describe('Authenticated route', () => {
    let client: ReturnType<typeof createTRPCProxyClient<typeof appRouter>>;
    let accessToken: string;

    beforeAll(() => {
      client = createTRPCProxyClient<typeof appRouter>({
        links: [
          accessTokenLink(ACCESS_TOKEN_NAME, (token) => {
            accessToken = token;
          }),
          httpBatchLink({
            url: `http://localhost:${options.port}`,
            headers: () => ({
              authorization: accessToken ? `Bearer ${accessToken}` : '',
            }),
          }),
        ],
      });
    });

    it('should throw if accessed by non authenticated user', async () => {
      await expect(client.testAuth.mutate()).rejects.toThrow('UNAUTHORIZED');
    });

    it('should access route using authorized client', async () => {
      await client.user.login.mutate(user);
      await expect(client.testAuth.mutate()).resolves.toEqual(true);
    });
  });
});
