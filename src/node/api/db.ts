import { Hex, keccak256 } from 'viem';
import { z } from 'zod';
import { Storage } from '../../storage/index.js';

/**
 * Interface defining the properties of a User object stored in storage.
 */
export interface User {
  /** The username of the user */
  login: string;
  /** The hashed password of the user */
  hashedPassword: string;
  /** The optional JSON Web Token of the user */
  jwt?: string;
}

/**
 * Validation schema for user creation API input.
 * It validates that the input contains a nonempty `login` and `password`.
 */
export const UserInputSchema = z.object({
  login: z.string().nonempty(),
  password: z.string().nonempty(),
});

/**
 * Type definition for User registration input,
 * inferred from UserInputSchema.
 */
export type UserInputType = z.infer<typeof UserInputSchema>;

/**
 * Interface defining the properties of UsersDb initialization options.
 */
export interface UsersDbOptions {
  /** Instance of storage used for persisting the state of the API server */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
  /** Salt used for hashing passwords */
  salt: string;
}

export class UsersDb {
  /** Storage instance for persisting the state of the API server */
  storage: Storage;
  /** Specific key prefix for the storage key to avoid potential key collisions */
  prefix: string;
  /** Salt used for hashing passwords */
  salt: string;

  /**
   * Creates an instance of UsersDb.
   * Initializes an instance of UsersDb with given options.
   *
   * @param {UsersDbOptions} options
   * @memberof NodeApiServer
   */
  constructor(options: UsersDbOptions) {
    const { storage, prefix, salt } = options;

    // TODO Validate NodeApiServerOptions

    this.prefix = `${prefix}_api_users_`;
    this.storage = storage;
    this.salt = salt;
  }

  /**
   * Hashes the given password with the given salt.
   *
   * @static
   * @param {string} password The password to be hashed
   * @param {string} salt The salt to be used for hashing
   * @returns {string} The hashed password
   * @memberof UsersDb
   */
  static hashPassword(password: string, salt: string): string {
    return keccak256(`${password}${salt}` as Hex);
  }

  /**
   * Generates a prefixed login key
   *
   * @private
   * @param {string} login The login for which the key is generated
   * @returns {string} The prefixed login key
   * @memberof UsersDb
   */
  private loginKey(login: string): string {
    return `${this.prefix}${login}`;
  }

  /**
   * Retrieves the user with the given login from storage.
   *
   * @param {string} login The login of the user to be retrieved
   * @returns {Promise<User>} The User object associated with the given login
   * @throws Will throw an error if the user is not found
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
   * Adds a new user to the storage.
   *
   * @param {string} login The login of the user to be added
   * @param {string} password The password of the user to be added
   * @returns {Promise<void>}
   * @throws Will throw an error if a user with the same login already exists
   * @memberof UsersDb
   */
  async add(login: string, password: string): Promise<void> {
    const knownUser = await this.storage.get<User>(this.loginKey(login));

    // Check if the user already exists
    if (knownUser) {
      throw new Error(`User ${login} already exists`);
    }

    // Save the user into the storage
    await this.storage.set<User>(this.loginKey(login), {
      login,
      hashedPassword: UsersDb.hashPassword(password, this.salt),
    });
  }

  /**
   * Updates the record of the user in the storage
   *
   * @param {User} user The user object
   * @returns {Promise<void>}
   * @memberof UsersDb
   */
  async set(user: User): Promise<void> {
    await this.storage.set<User>(this.loginKey(user.login), user);
  }

  /**
   * Deletes the user from storage
   *
   * @param {string} login The user login name
   * @returns {Promise<void>}
   * @throws Will throw an error if not possible to delete the user
   * @memberof UsersDb
   */
  async delete(login: string): Promise<void> {
    const deleted = await this.storage.delete(this.loginKey(login));

    if (!deleted) {
      throw new Error(`Unable to delete user ${login}`);
    }
  }
}
