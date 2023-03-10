// Key-value database abstraction layer interface
export abstract class Storage<CustomValueType> {
  abstract set(key: string, value: CustomValueType): Promise<void>;
  abstract get(key: string): Promise<CustomValueType | undefined>;
  abstract delete(key: string): Promise<boolean>;
  abstract entries(): IterableIterator<[string, CustomValueType]>;
}

// Storage initializer callback function type
export type StorageInitializerFunction = <CustomStorageOptions extends object = object>(
  options?: CustomStorageOptions,
) => <CustomValueType>() => Promise<Storage<CustomValueType>>;

// Storage initializer type
export type StorageInitializer = ReturnType<StorageInitializerFunction>;
