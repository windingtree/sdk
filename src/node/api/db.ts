import { Hex, keccak256 } from 'viem';
import { z } from 'zod';
import { Storage } from '../../storage/index.js';

/**
 * User object stored in the storage
 */
export interface User {
  login: string;
  hashedPassword: string;
  jwt?: string;
}

/**
 * User creation API input validation schema
 */
export const UserInputSchema = z.object({
  login: z.string(),
  password: z.string(),
});

/**
 * Users database initialization options type
 */
export interface UsersDbOptions {
  /** Instance of storage used for persisting the state of the API server */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
  /** Passwords hashing salt */
  salt: string;
}

export class UsersDb {
  /** Storage instance for persisting the state of the API server */
  private storage: Storage;
  /** Specific key prefix for the storage key to avoid potential key collisions */
  private prefix: string;
  /** Passwords hashing salt */
  salt: string;

  /**
   * Creates an instance of UsersDb.
   *
   * @param {UsersDbOptions} options
   * @memberof NodeApiServer
   */
  constructor(options: UsersDbOptions) {
    const { storage, prefix, salt } = options;

    // @todo Validate NodeApiServerOptions

    this.prefix = `${prefix}_api_users_`;
    this.storage = storage;
    this.salt = salt;
  }

  static hashPassword(password: string, salt: string): string {
    return keccak256(`${password}${salt}` as Hex);
  }

  /**
   * Returns prefixed login key
   *
   * @private
   * @param {string} login
   * @returns {string}
   * @memberof UsersDb
   */
  private loginKey(login: string): string {
    return `${this.prefix}${login}`;
  }

  /**
   * Returns the user from storage
   *
   * @param {string} login
   * @returns {Promise<User>}
   * @memberof UsersDb
   */
  async get(login: string): Promise<User> {
    const user = await this.storage.get<User>(this.loginKey(login));

    if (!user) {
      throw new Error(`User ${login} not found`);
    }

    return user;
  }

  /**
   * Creates a new user record in the storage
   *
   * @param {string} login
   * @param {string} password
   * @returns {Promise<void>}
   * @memberof UsersDb
   */
  async add(login: string, password: string): Promise<void> {
    const knownUser = await this.storage.get<User>(this.loginKey(login));

    if (knownUser) {
      throw new Error(`User ${login} already exists`);
    }

    await this.storage.set<User>(this.loginKey(login), {
      login,
      hashedPassword: UsersDb.hashPassword(password, this.salt),
    });
  }

  async set(user: User): Promise<void> {
    await this.storage.set<User>(this.loginKey(user.login), user);
  }

  async delete(login: string): Promise<void> {
    const deleted = await this.storage.delete(this.loginKey(login));

    if (!deleted) {
      throw new Error(`Unable to delete user ${login}`);
    }
  }
}
