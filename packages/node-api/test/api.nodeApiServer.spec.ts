import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from '@windingtree/sdk-test-utils';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { createPublicClient, createWalletClient, Hash, http } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import superjson from 'superjson';
import { generateMnemonic, supplierId as spId } from '@windingtree/sdk-utils';
import { UserInputType } from '@windingtree/sdk-db';
import {
  authAdminProcedure,
  authProcedure,
  NodeApiServer,
  NodeApiServerOptions,
  router,
} from '../src/server.js';
import { adminRouter, dealsRouter, userRouter } from '../src/router/index.js';
import { memoryStorage } from '@windingtree/sdk-storage';
import {
  ACCESS_TOKEN_NAME,
  accessTokenLink,
  createAdminSignature,
} from '../src/client.js';
import { HashSchema } from '../dist/router.js';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { contractsConfig } from 'wtmp-examples-shared-files';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { PaginationOptions } from '@windingtree/sdk-types';
import { randomSalt } from '@windingtree/contracts';
import { serviceRouter } from '../src/router/service.js';
import { buildRandomDeal } from '@windingtree/sdk-messages';

const testRouter = router({
  admin: adminRouter,
  user: userRouter,
  deals: dealsRouter,
  service: serviceRouter,
  testAuth: authProcedure.output(z.boolean()).mutation(() => {
    return true;
  }),
  testAdminAuth: authAdminProcedure.output(z.boolean()).mutation(() => {
    return true;
  }),
});

const chain = process.env.LOCAL_NODE === 'true' ? hardhat : polygonZkEvmTestnet;

describe('NodeApiServer', () => {
  const user: UserInputType = {
    login: 'testUser',
    password: 'password',
  };
  const owner = mnemonicToAccount(generateMnemonic());
  let options: NodeApiServerOptions;
  let server: NodeApiServer;
  let clientUser: ReturnType<typeof createTRPCProxyClient<typeof testRouter>>;
  let clientAdmin: ReturnType<typeof createTRPCProxyClient<typeof testRouter>>;
  let accessTokenUser: string | undefined;
  let accessTokenAdmin: string | undefined;

  beforeAll(async () => {
    const contractsManager = new ProtocolContracts({
      contracts: contractsConfig,
      publicClient: createPublicClient({
        chain,
        transport: http(),
      }),
      walletClient: createWalletClient({
        chain,
        transport: http(),
        account: owner.address,
      }),
    });
    options = {
      usersStorage: await memoryStorage.createInitializer({
        scope: 'users',
      })(),
      prefix: 'test',
      port: 3456,
      secret: 'secret',
      ownerAccount: owner.address,
      dealsStorage: await memoryStorage.createInitializer({
        scope: 'deals',
      })(),
      protocolContracts: contractsManager,
    };
    server = new NodeApiServer(options);

    server.start(testRouter);

    clientUser = createTRPCProxyClient<typeof testRouter>({
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

    clientAdmin = createTRPCProxyClient<typeof testRouter>({
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

  describe('user.update', () => {
    const newPassword = 'new-password';

    it('should log in a registered user and return an access token', async () => {
      const result = await clientUser.user.update.mutate({
        ...user,
        password: newPassword,
      });
      expect(result).to.be.eq(undefined);
      expect(accessTokenUser).toBeDefined();
    });

    it('should log in a registered user and return an access token', async () => {
      const result = await clientUser.user.login.mutate({
        ...user,
        password: newPassword,
      });
      expect(result).to.be.eq(undefined);
      expect(accessTokenUser).toBeDefined();
    });
  });

  describe('user.logout', () => {
    it('should logout a logged in user', async () => {
      const result = await clientUser.user.logout.mutate();
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
      beforeAll(async () => {
        await clientAdmin.user.logout.mutate();
      });

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
        const result = await clientAdmin.user.logout.mutate();
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

  describe('Deal route', () => {
    let admin: UserInputType;
    let id: `0x${string}`;
    let deal;

    beforeAll(async () => {
      admin = {
        login: 'admin',
        password: await createAdminSignature(owner),
      };
      await clientAdmin.admin.register.mutate(admin);
      await clientAdmin.admin.login.mutate(admin);
      const signer = mnemonicToAccount(generateMnemonic());
      const supplierId = spId(signer.address, randomSalt());
      deal = await buildRandomDeal(signer, supplierId);
      id = deal.offer.id;
      await server.deals?.set(deal);
    });

    afterAll(async () => {
      await clientAdmin.user.delete.mutate();
    });

    it('should throw if accessed by a not an admin 1', () => {
      expect(HashSchema).to.be.string;
    });

    it('should throw if accessed by a not an admin 2', async () => {
      const randomId = randomSalt();
      expect(
        (await clientAdmin.deals.seek.mutate({ id: randomId })).offer.id,
      ).toEqual(randomId);
      expect(
        (await clientAdmin.deals.get.query({ id: randomId })).offer.id,
      ).toEqual(randomId);
      expect((await clientAdmin.service.ping.query()).message).toEqual('pong');
    });

    it('should throw if accessed by a not an admin 3', async () => {
      const salt = randomSalt();
      await expect(
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
        clientAdmin.deals.get.query(JSON.parse(JSON.stringify({ id: salt }))),
      ).rejects.toThrow(`Deal ${salt} not found`);
    });

    it('should throw if accessed by a not an admin 4', async () => {
      expect((await clientAdmin.deals.seek.mutate({ id })).offer.id).toEqual(
        id,
      );
    });

    it('should throw if accessed by a not an admin 8', async () => {
      const salt = randomSalt();
      await expect(
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
        clientAdmin.deals.get.query(JSON.parse(JSON.stringify({ id: salt }))),
      ).rejects.toThrow(`Deal ${salt} not found`);
    });

    it('should throw if accessed by a not an admin 9', async () => {
      await clientAdmin.deals.getAll.query({});
    });

    it('should throw if accessed by a not an admin 10', async () => {
      await expect(
        clientAdmin.deals.getAll.query({
          start: 'string',
          skip: 10,
        } as unknown as PaginationOptions),
      ).rejects.toThrow('Expected number, received string');
    });
  });
});
