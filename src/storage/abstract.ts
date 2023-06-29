/**
 * Key-value database abstraction layer interface
 */
export abstract class Storage {
  abstract set<CustomValueType = unknown>(
    key: string,
    value: CustomValueType,
  ): Promise<void>;
  abstract get<CustomValueType = unknown>(
    key: string,
  ): Promise<CustomValueType | undefined>;
  abstract delete(key: string): Promise<boolean>;
  abstract entries<CustomValueType = unknown>(): IterableIterator<
    [string, CustomValueType]
  >;
}

export interface GenericStorageOptions {
  scope?: string;
}

/**
 * Storage initializer type
 */
export type StorageInitializer = () => Promise<Storage>;

/**
 * Storage initializer callback function type
 */
export type StorageInitializerFunction = (
  options?: GenericStorageOptions,
) => StorageInitializer;
