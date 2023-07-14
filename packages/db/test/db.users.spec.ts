import { describe, beforeAll, it, expect } from './setup.js';
import { createInitializer } from '../src/storage/memory.js';
import {
  UsersDb,
  UsersDbOptions,
  User,
  comparePassword,
} from '../src/node/db/users.js';

describe('Node.API.Db', () => {
  const password = 'password';
  let userDb: UsersDb;
  let testUser: User;

  beforeAll(async () => {
    const options: UsersDbOptions = {
      storage: await createInitializer({
        scope: 'users',
      })(),
      prefix: 'test',
    };
    userDb = new UsersDb(options);
    testUser = {
      login: 'testUser',
      hashedPassword: await UsersDb.hashPassword('password'),
    };
  });

  describe('#add', () => {
    it('should add a new user', async () => {
      await userDb.add(testUser.login, password);
      const user = await userDb.get(testUser.login);
      expect(user.login).to.be.eq(testUser.login);
      expect(await comparePassword(password, user.hashedPassword)).to.be.true;
    });

    it('should throw an error when trying to add an existing user', async () => {
      let error = null;
      try {
        await userDb.add(testUser.login, password);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('Error');
      expect((error as Error).message).to.be.eq(
        `User ${testUser.login} already exists`,
      );
    });
  });

  describe('#get', () => {
    it('should get a user', async () => {
      const user = await userDb.get(testUser.login);
      expect(user.login).to.be.eq(testUser.login);
      expect(await comparePassword(password, user.hashedPassword)).to.be.true;
    });

    it('should throw an error when trying to get a non-existent user', async () => {
      let error = null;
      try {
        await userDb.get('nonExistentUser');
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('Error');
      expect((error as Error).message).to.be.eq(
        'User nonExistentUser not found',
      );
    });
  });

  describe('#set', () => {
    it('should update a user', async () => {
      const updatedUser = { ...testUser, jwt: 'jwtToken' };
      await userDb.set(updatedUser);
      const user = await userDb.get(testUser.login);
      expect(user).to.deep.equal(updatedUser);
    });
  });

  describe('#delete', () => {
    it('should delete a user', async () => {
      await userDb.delete(testUser.login);
      let error = null;
      try {
        await userDb.get(testUser.login);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('Error');
      expect((error as Error).message).to.be.eq(
        `User ${testUser.login} not found`,
      );
    });

    it('should throw an error when trying to delete a non-existent user', async () => {
      let error = null;
      try {
        await userDb.delete('nonExistentUser');
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('Error');
      expect((error as Error).message).to.be.eq(
        'Unable to delete user nonExistentUser',
      );
    });
  });
});
