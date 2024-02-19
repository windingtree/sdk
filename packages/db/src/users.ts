import { z } from 'zod';
import { hash } from 'bcrypt-ts';
import { Storage } from '@windingtree/sdk-storage';

export { compare as comparePassword } from 'bcrypt-ts';

/**
 * Interface defining the properties of a User object stored in storage.
 */
export interface User {
  /** The username of the user */
  login: string;
  /** The hashed password of the user */
  hashedPassword: string;
  /** Flag which indicate that the use is admin */
  isAdmin?: boolean;
  /** The optional JSON Web Token of the user */
  jwt?: string;
}

/**
 * Validation schema for user creation API input.
 * It validates that the input contains a nonempty `login` and `password`.
 */
export const UserInputSchema = z.object({
  login: z.string().min(1),
  password: z.union([z.string().min(1), z.string().startsWith('0x')]),
});

/**
 * Type definition for User registration input,
 * inferred from UserInputSchema.
 */
export type UserInputType = z.infer<typeof UserInputSchema>;

/**
 * User output schema
 */
export const SafeUserSchema = z.object({
  login: z.string().min(1),
  isAdmin: z.boolean().optional(),
});

/**
 * Users list output schema
 */
export const UsersListOutputSchema = z.array(SafeUserSchema);

/**
 * Type definition for sanitized User record,
 * inferred from SafeUserSchema.
 */
export type SafeUserType = z.infer<typeof SafeUserSchema>;

/**
 * Type definition for sanitized Users records list,
 * inferred from UsersListOutputSchema.
 */
export type UsersListOutputSchema = z.infer<typeof UsersListOutputSchema>;

/**
 * Interface defining the properties of UsersDb initialization options.
 */
export interface UsersDbOptions {
  /** Instance of storage used for persisting the state of the API server */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
}

/**
 * Class that implements an API to the users records storage
 *
 * @export
 * @class UsersDb
 */
export class UsersDb {
  /** Storage instance for persisting the state of the API server */
  storage: Storage;
  /** Specific key prefix for the storage key to avoid potential key collisions */
  prefix: string;

  /**
   * Creates an instance of UsersDb.
   * Initializes an instance of UsersDb with given options.
   *
   * @param {UsersDbOptions} options
   * @memberof UsersDb
   */
  constructor(options: UsersDbOptions) {
    const { storage, prefix } = options;

    // TODO Validate UsersDbOptions

    this.prefix = `${prefix}_api_users_`;
    this.storage = storage;
  }

  /**
   * Hashes the given password with the given salt.
   *
   * @static
   * @param {string} password The password to be hashed
   * @returns {string} The hashed password
   * @memberof UsersDb
   */
  static async hashPassword(password: string): Promise<string> {
    return await hash(password, 10);
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
    const user = await this.storage.get<User>(`${this.prefix}${login}`);

    if (!user) {
      throw new Error(`User ${login} not found`);
    }

    return user;
  }

  /**
   * Retrieves the user with the given login from storage.
   *
   * @returns {Promise<User[]>} The User object associated with the given login
   * @throws Will throw an error if the user is not found
   * @memberof UsersDb
   */
  async getAll(): Promise<User[]> {
    const records: User[] = [];

    for (const record of await this.storage.entries<User>()) {
      if (record[0].startsWith(this.prefix)) {
        records.push(record[1]);
      }
    }

    return records;
  }

  /**
   * Adds a new user to the storage.
   *
   * @param {string} login The login of the user to be added
   * @param {string} password The password of the user to be added
   * @param {boolean} [isAdmin] Option which indicate that the use is admin
   * @returns {Promise<void>}
   * @throws Will throw an error if a user with the same login already exists
   * @memberof UsersDb
   */
  async add(
    login: string,
    password: string,
    isAdmin: boolean = false,
  ): Promise<void> {
    const knownUser = await this.storage.get<User>(`${this.prefix}${login}`);

    // Check if the user already exists
    if (knownUser) {
      throw new Error(`User ${login} already exists`);
    }

    // Save the user into the storage
    await this.storage.set<User>(`${this.prefix}${login}`, {
      login,
      hashedPassword: await UsersDb.hashPassword(password),
      isAdmin,
    });
  }

  /**
   * Updates the record of the user in the storage
   *
   * @param {User} user The user object
   * @param {string} [password] The new password of the user
   * @returns {Promise<void>}
   * @memberof UsersDb
   */
  async set(user: User, password?: string): Promise<void> {
    if (password) {
      user.hashedPassword = await UsersDb.hashPassword(password);
    }

    await this.storage.set<User>(`${this.prefix}${user.login}`, user);
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
    const deleted = await this.storage.delete(`${this.prefix}${login}`);

    if (!deleted) {
      throw new Error(`Unable to delete user ${login}`);
    }
  }
}
