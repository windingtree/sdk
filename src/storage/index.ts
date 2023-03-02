// Key-value database abstraction layer interface
export abstract class Storage<CustomValueType> {
  set: (key: string, value: CustomValueType) => Promise<void>;
  get: (key: string) => Promise<CustomValueType | undefined>;
  delete: (key: string) => Promise<boolean>;
  entries: () => IterableIterator<[string, CustomValueType]>;
}

// Storage initializer function.
// Must return initialized storage instance
export type StorageInitializer = <CustomValueType, CustomStorageOptions extends object>(
  options?: CustomStorageOptions,
) => Promise<Storage<CustomValueType>>;
