import { z } from 'zod';

/**
 * Key-value database abstraction layer interface
 */
export abstract class Storage {
  abstract set<CustomValueType = unknown>(key: string, value: CustomValueType): Promise<void>;
  abstract get<CustomValueType = unknown>(key: string): Promise<CustomValueType | undefined>;
  abstract delete(key: string): Promise<boolean>;
  abstract entries<CustomValueType = unknown>(): IterableIterator<[string, CustomValueType]>;
}

/**
 * Storage initializer schema
 */
export const StorageInitializerSchema = z.function().returns(z.promise(z.instanceof(Storage)));

/**
 * Storage initializer type
 */
export type StorageInitializer = z.infer<typeof StorageInitializerSchema>;

/**
 * Creates a storage initializer function schema
 *
 * @param {z.ZodType} initializerOptionsSchema Initializer function options schema
 * @returns {z.ZodType}
 */
export const createStorageInitializerFactorySchema = <
  InitializerOptionsSchema extends z.ZodTypeAny,
>(
  initializerOptionsSchema: InitializerOptionsSchema,
) => z.function().args(initializerOptionsSchema).returns(StorageInitializerSchema);

/**
 * Storage initializer callback function type
 */
export type StorageInitializerFunction = z.infer<
  ReturnType<typeof createStorageInitializerFactorySchema>
>;
