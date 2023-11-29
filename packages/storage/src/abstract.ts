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
  abstract entries<CustomValueType = unknown>():
    | IterableIterator<[string, CustomValueType]>
    | Promise<[[string, CustomValueType]]>;
}

export interface GenericStorageOptions {
  scope?: string;
  path?: string;
}

/**
 * Storage initializer type
 */
export type StorageInitializer<T extends Storage = Storage> = () => Promise<T>;

/**
 * Storage initializer callback function type
 */
export type StorageInitializerFunction<
  T extends Storage = Storage,
  O extends GenericStorageOptions = GenericStorageOptions,
> = (options?: O) => StorageInitializer<T>;
