import { z } from 'zod';
import { AbstractProvider } from 'ethers';
import { GenericOfferOptions, GenericQuery } from '../shared/messages.js';
import { ContractConfigSchema } from '../utils/contract.js';
import { parseSeconds } from '../utils/time.js';
import { noncePeriod } from '../constants.js';
import { StorageInitializerSchema } from '../storage/abstract.js';
import { RequestRegistryPrefixSchema } from '../client/requestManager.js';

export const createQuerySchemaOptionSchema = <CustomRequestQuery extends GenericQuery>() =>
  z.object({
    /** Query validation schema instance */
    querySchema: z.instanceof(z.ZodType<CustomRequestQuery>),
  });

export const createOfferOptionsSchemaOptionSchema = <
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z.object({
    /** Offer options validation schema instance */
    offerOptionsSchema: z.instanceof(z.ZodType<CustomOfferOptions>),
  });

export const NoncePeriodOptionSchema = z.object({
  /** Period while the node waits and accepting requests with the same Id */
  noncePeriod: z.number().int().nonnegative().default(parseSeconds(noncePeriod)),
});

export const ContractConfigOptionSchema = z.object({
  /** The protocol smart contract configuration */
  contractConfig: ContractConfigSchema,
});

export const ProviderOptionSchema = z.object({
  /** Ethers.js provider instance */
  provider: z.instanceof(AbstractProvider).optional(),
});

export const ServerAddressOptionSchema = z.object({
  /** Multiaddr of the coordination server */
  serverAddress: z.string(),
});

export const SignerSeedOptionsSchema = z.object({
  /** Seed phrase of the node signer wallet */
  signerSeedPhrase: z.string(),
});

/**
 * Creates the protocol node initialization options schema
 * @returns z.ZodType
 */
export const createNodeOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      /** libp2p configuration options */
      libp2p: z.object({}).catchall(z.any()).optional(),
      /** Subscription topics of node */
      topics: z.array(z.string()),
      /** Unique supplier Id */
      supplierId: z.string(),
    })
    .merge(createQuerySchemaOptionSchema<CustomRequestQuery>())
    .merge(createOfferOptionsSchemaOptionSchema<CustomOfferOptions>())
    .merge(NoncePeriodOptionSchema)
    .merge(ContractConfigOptionSchema)
    .merge(ProviderOptionSchema)
    .merge(ServerAddressOptionSchema)
    .merge(SignerSeedOptionsSchema)
    .strict();

/**
 * The protocol node initialization options type
 */
export type NodeOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createNodeOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

/**
 * Creates request manager (of the protocol node) initialization options schema
 * @returns z.ZodType
 */
export const createRequestManagerOptionsSchema = <CustomRequestQuery extends GenericQuery>() =>
  z
    .object({})
    .merge(createQuerySchemaOptionSchema<CustomRequestQuery>())
    .merge(NoncePeriodOptionSchema)
    .strict();

/**
 * Request manager (of the protocol node) initialization options type
 */
export type RequestManagerOptions<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestManagerOptionsSchema<CustomRequestQuery>>
>;

/**
 * Creates the protocol client initialization schema
 * @returns z.ZodType
 */
export const createClientOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      /** libp2p configuration options */
      libp2p: z.object({}).catchall(z.any()).optional(),
      /** Storage initializer function */
      storageInitializer: StorageInitializerSchema,
      /** Request registry keys prefix */
      requestRegistryPrefix: RequestRegistryPrefixSchema,
    })
    .merge(createQuerySchemaOptionSchema<CustomRequestQuery>())
    .merge(createOfferOptionsSchemaOptionSchema<CustomOfferOptions>())
    .merge(ContractConfigOptionSchema)
    .merge(ProviderOptionSchema)
    .merge(ServerAddressOptionSchema)
    .strict();

/**
 * The protocol client initialization schema type
 */
export type ClientOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createClientOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

/**
 * Interface of a node key in Json format (schema)
 */
export const NodeKeyJsonSchema = z
  .object({
    /** Peer Id */
    id: z.string(),
    /** Private key */
    privKey: z.string(),
    /** Public key */
    pubKey: z.string(),
  })
  .strict();

/**
 * Interface of a node key in Json format (type)
 */
export type NodeKeyJson = z.infer<typeof NodeKeyJsonSchema>;

/**
 * Peer configuration options schema
 */
export const PeerOptionsSchema = z
  .object({
    /** Peer key */
    peerKey: NodeKeyJsonSchema.optional(),
  })
  .strict();

/**
 * Peer configuration options type
 */
export type PeerOptions = z.infer<typeof PeerOptionsSchema>;

/**
 * The protocol coordination server options schema
 */
export const ServerOptionsSchema = PeerOptionsSchema.required()
  .extend({
    /** Optional IP address of the server, defaults to '0.0.0.0' */
    address: z.string().optional(),
    /** Server port */
    port: z.number(),
    /** Messages storage initializer */
    messagesStorageInit: StorageInitializerSchema,
  })
  .strict();

/**
 * The protocol coordination server options type
 */
export type ServerOptions = z.infer<typeof ServerOptionsSchema>;
