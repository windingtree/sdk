import { z } from 'zod';

export const GenericStorageEngineOptionsSchema = z.object({});

export type GenericStorageEngineOptions = z.infer<typeof GenericStorageEngineOptionsSchema>;

export const NodeKeyJsonSchema = z
  .object({
    id: z.string(), // Peer Id
    privKey: z.string(), // Private key
    pubKey: z.string(), // Public key
  })
  .strict();

export type NodeKeyJson = z.infer<typeof NodeKeyJsonSchema>;

// Storage initializer configuration nodeKeyJsonoptions
export const createStorageOptionsSchema = <CustomStorageEngineOptions extends GenericStorageEngineOptions>(
  optionsSchema: z.ZodType<CustomStorageEngineOptions>,
) =>
  GenericStorageEngineOptionsSchema.extend({
    engine: z.function().args(optionsSchema.optional()), // A storage engine initialization callback
    options: optionsSchema.optional(), // Optional storage initialization options
  }).strict();

export type StorageOptions<CustomStorageEngineOptions extends GenericStorageEngineOptions> = z.infer<
  ReturnType<typeof createStorageOptionsSchema<CustomStorageEngineOptions>>
>;

// Peer configuration options
export const PeerOptionsSchema = z
  .object({
    peerKey: NodeKeyJsonSchema.optional(), // Peer key
  })
  .strict();

export type PeerOptions = z.infer<typeof PeerOptionsSchema>;

// Server options
export const createServerOptionsSchema = <CustomStorageEngineOptions extends GenericStorageEngineOptions>(
  optionsSchema: z.ZodType<CustomStorageEngineOptions>,
) =>
  PeerOptionsSchema.required().extend({
    address: z.string().optional(), // Optional IP address of the server, defaults to '0.0.0.0'
    port: z.number(), // libp2p listening port
    storage: createStorageOptionsSchema<CustomStorageEngineOptions>(optionsSchema).optional(), // Optional servers' data storage
  });

export type ServerOptions<CustomStorageEngineOptions extends GenericStorageEngineOptions> = z.infer<
  ReturnType<typeof createServerOptionsSchema<CustomStorageEngineOptions>>
>;
