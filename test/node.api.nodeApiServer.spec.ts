import { describe, beforeAll, afterAll, it, expect } from './setup.js';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { Hash } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import superjson from 'superjson';
import { generateMnemonic } from '../src/utils/wallet.js';
import {
  UserInputType,
  NodeApiServer,
  NodeApiServerOptions,
  ACCESS_TOKEN_NAME,
  userRouter,
  adminRouter,
  router,
  accessTokenLink,
  authProcedure,
  authAdminProcedure,
  createAdminSignature,
} from '../src/node/api/index.js';
import { createInitializer } from '../src/storage/memory.js';

const appRouter = router({
  user: userRouter,
  admin: adminRouter,
  testAuth: authProcedure.output(z.boolean()).mutation(() => {
    return true;
  }),
  testAdminAuth: authAdminProcedure.output(z.boolean()).mutation(() => {
    return true;
  }),
});

describe('NodeApiServer', () => {
  const user: UserInputType = {
    login: 'testUser',
    password: 'password',
  };
  const owner = mnemonicToAccount(generateMnemonic());
  let options: NodeApiServerOptions;
  let server: NodeApiServer;
  let clientUser: ReturnType<typeof createTRPCProxyClient<typeof appRouter>>;
  let clientAdmin: ReturnType<typeof createTRPCProxyClient<typeof appRouter>>;
  let accessTokenUser: string | undefined;
  let accessTokenAdmin: string | undefined;

  beforeAll(async () => {
    options = {
      usersStorage: await createInitializer({
        scope: 'users',
      })(),
      prefix: 'test',
      port: 3456,
      secret: 'secret',
      ownerAccount: owner.address,
    };
    server = new NodeApiServer(options);

    server.start(appRouter);

    clientUser = createTRPCProxyClient<typeof appRouter>({
      transformer: superjson,
      links: [
        accessTokenLink(ACCESS_TOKEN_NAME, (token) => {
          accessTokenUser = token;
        }),
        httpBatchLink({
          url: `http://localhost:${options.port}`,
          headers: () => ({
            authorization: accessTokenUser ? `Bearer ${accessTokenUser}` : '',
          }),
        }),
      ],
    });

    clientAdmin = createTRPCProxyClient<typeof appRouter>({
      transformer: superjson,
      links: [
        accessTokenLink(ACCESS_TOKEN_NAME, (token) => {
          accessTokenAdmin = token;
        }),
        httpBatchLink({
          url: `http://localhost:${options.port}`,
          headers: () => ({
            authorization: accessTokenAdmin ? `Bearer ${accessTokenAdmin}` : '',
          }),
        }),
      ],
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('user.register', () => {
    let admin: UserInputType;

    beforeAll(async () => {
      admin = {
        login: 'admin',
        password: await createAdminSignature(owner),
      };
      await clientAdmin.admin.register.mutate(admin);
      await clientAdmin.admin.login.mutate(admin);
    });

    afterAll(async () => {
      await clientAdmin.user.delete.mutate();
    });

    it('should throw if accessed by a not an admin', async () => {
      await expect(clientUser.user.register.mutate(user)).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });

    it('should register a new user (by admin)', async () => {
      const result = await clientAdmin.user.register.mutate(user);
      expect(result).to.be.eq(undefined);
    });

    it('should throw an error when trying to register an existing user', async () => {
      await expect(clientAdmin.user.register.mutate(user)).rejects.toThrow(
        `User ${user.login} already exists`,
      );
    });
  });

  describe('user.login', () => {
    it('should throw if accessed by non authenticated user', async () => {
      await expect(clientUser.testAuth.mutate()).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });

    it('should log in a registered user and return an access token', async () => {
      const result = await clientUser.user.login.mutate(user);
      expect(result).to.be.eq(undefined);
      expect(accessTokenUser).toBeDefined();
    });

    it('should throw an error when trying to log in with incorrect password', async () => {
      await expect(
        clientUser.user.login.mutate({
          ...user,
          password: 'invalid-password',
        }),
      ).rejects.toThrow('Invalid login or password');
    });

    it('should access route using authorized client', async () => {
      await expect(clientUser.testAuth.mutate()).resolves.toEqual(true);
    });

    it('should access route (admin only) using authorized client', async () => {
      await expect(clientUser.testAdminAuth.mutate()).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });
  });

  describe('user.logout', () => {
    it('should logout a logged in user', async () => {
      const result = await clientUser.user.logout.mutate(user);
      expect(result).to.be.eq(undefined);
      expect(accessTokenUser).toBeDefined();
    });

    it('should throw an error when trying to access authenticated route', async () => {
      await expect(clientUser.testAuth.mutate()).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });
  });

  describe('user.delete', () => {
    let newUser: UserInputType;
    let admin: UserInputType;

    beforeAll(async () => {
      newUser = {
        ...user,
        login: 'new-user',
      };
      admin = {
        login: 'admin',
        password: await createAdminSignature(owner),
      };
      await clientAdmin.admin.register.mutate(admin);
      await clientAdmin.admin.login.mutate(admin);
    });

    afterAll(async () => {
      await clientAdmin.user.delete.mutate();
    });

    it('should throw if called by non authorized user', async () => {
      await expect(clientUser.user.delete.mutate()).rejects.toThrow(
        'UNAUTHORIZED',
      );
    });

    it('should delete existed user', async () => {
      await clientAdmin.user.register.mutate(newUser);
      await clientUser.user.login.mutate(newUser);
      const result = await clientUser.user.delete.mutate();
      expect(result).to.be.eq(undefined);
      accessTokenUser = undefined;
    });

    it('should throw on try to login with deleted user ', async () => {
      await expect(clientUser.user.login.mutate(newUser)).rejects.toThrow(
        'User new-user not found',
      );
    });
  });

  describe('Admin route', () => {
    const name = 'admin;';

    describe('admin.register', () => {
      it('should register a new admin', async () => {
        const signature = await createAdminSignature(owner);
        const result = await clientAdmin.admin.register.mutate({
          login: name,
          password: signature,
        });
        expect(result).to.be.eq(undefined);
      });

      it('should throw an error when trying to register an existing admin', async () => {
        const signature = await createAdminSignature(owner);
        const user = {
          login: name,
          password: signature,
        };
        await expect(clientAdmin.admin.register.mutate(user)).rejects.toThrow(
          `User ${user.login} already exists`,
        );
      });
    });

    describe('admin.login', () => {
      it('should throw if accessed by non authenticated admin', async () => {
        await expect(clientAdmin.testAdminAuth.mutate()).rejects.toThrow(
          'UNAUTHORIZED',
        );
      });

      it('should log in an admin and return an access token', async () => {
        const signature = await createAdminSignature(owner);
        const user = {
          login: name,
          password: signature,
        };
        const result = await clientAdmin.admin.login.mutate(user);
        expect(result).to.be.eq(undefined);
        expect(accessTokenAdmin).toBeDefined();
      });

      it('should throw an error when trying to log in with incorrect signature', async () => {
        const invalidOwner = mnemonicToAccount(generateMnemonic());
        const signature = await createAdminSignature(invalidOwner);
        const user = {
          login: name,
          password: signature,
        };
        await expect(clientAdmin.admin.login.mutate(user)).rejects.toThrow(
          'Invalid signature',
        );
      });

      it('should access route (normal) using authorized client', async () => {
        await expect(clientAdmin.testAuth.mutate()).resolves.toEqual(true);
      });

      it('should access route (admin only) using authorized client', async () => {
        await expect(clientAdmin.testAdminAuth.mutate()).resolves.toEqual(true);
      });
    });

    describe('user.logout (by admin)', () => {
      it('should logout a logged in admin', async () => {
        const result = await clientAdmin.user.logout.mutate(user);
        expect(result).to.be.eq(undefined);
        expect(accessTokenAdmin).toBeDefined();
      });

      it('should throw an error when trying to access authenticated route (normal)', async () => {
        await expect(clientAdmin.testAuth.mutate()).rejects.toThrow(
          'UNAUTHORIZED',
        );
      });

      it('should throw an error when trying to access authenticated route (admin only)', async () => {
        await expect(clientAdmin.testAdminAuth.mutate()).rejects.toThrow(
          'UNAUTHORIZED',
        );
      });
    });

    describe('user.delete (by admin)', () => {
      let signature: Hash;
      let newUser: UserInputType;

      beforeAll(async () => {
        signature = await createAdminSignature(owner);
        newUser = {
          login: `new-${name}`,
          password: signature,
        };
      });

      it('should throw if called by non authorized user', async () => {
        await expect(clientAdmin.user.delete.mutate()).rejects.toThrow(
          'UNAUTHORIZED',
        );
      });

      it('should delete existed admin', async () => {
        await clientAdmin.admin.register.mutate(newUser);
        await clientAdmin.admin.login.mutate(newUser);
        const result = await clientAdmin.user.delete.mutate();
        expect(result).to.be.eq(undefined);
        accessTokenAdmin = undefined;
      });

      it('should throw on try to login with deleted user ', async () => {
        const signature = await createAdminSignature(owner);
        const newUser = {
          login: `new-${name}`,
          password: signature,
        };
        await expect(clientAdmin.admin.login.mutate(newUser)).rejects.toThrow(
          `User new-${name} not found`,
        );
      });
    });
  });
});
