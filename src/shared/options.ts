import { z } from 'zod';
import { AbstractProvider } from 'ethers';
import { GenericOfferOptions, GenericQuery } from '../shared/messages.js';
import { ContractConfigSchema } from '../utils/contract.js';
import { parseSeconds } from '../utils/time.js';
import { noncePeriod } from '../constants.js';

export const createQuerySchemaOptionSchema = <CustomRequestQuery extends GenericQuery>() =>
  z.object({
    querySchema: z.instanceof(z.ZodType<CustomRequestQuery>), // Should be zod schema instance
  });

export const createOfferOptionsSchemaOptionSchema = <
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z.object({
    offerOptionsSchema: z.instanceof(z.ZodType<CustomOfferOptions>), // Should be zod schema instance
  });

export const NoncePeriodOptionSchema = z.object({
  noncePeriod: z.number().default(parseSeconds(noncePeriod)), // Period while the node accepting requests with the same Id
});

export const ContractConfigOptionSchema = z.object({
  contractConfig: ContractConfigSchema, // The protocol smart contract configuration
});

export const ProviderOptionSchema = z.object({
  provider: z.instanceof(AbstractProvider).optional(), // Ethers.js provider instance
});

export const ServerAddressOptionSchema = z.object({
  serverAddress: z.string(), // Multiaddr of the coordination server
});

export const SignerSeedOptionsSchema = z.object({
  signerSeedPhrase: z.string(), // Seed phrase of the node signer
});

// The protocol node initialization options schema
export const createNodeOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      libp2p: z.object({}).catchall(z.any()).optional(),
      topics: z.array(z.string()),
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

// The protocol node initialization options type
export type NodeOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createNodeOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

// Request manager (of the protocol node) initialization options schema
export const createRequestManagerOptionsSchema = <CustomRequestQuery extends GenericQuery>() =>
  z
    .object({})
    .merge(createQuerySchemaOptionSchema<CustomRequestQuery>())
    .merge(NoncePeriodOptionSchema)
    .strict();

// Request manager (of the protocol node) initialization options type
export type RequestManagerOptions<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestManagerOptionsSchema<CustomRequestQuery>>
>;

// The protocol client initialization schema
export const createClientOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      libp2p: z.object({}).catchall(z.any()).optional(),
    })
    .merge(createQuerySchemaOptionSchema<CustomRequestQuery>())
    .merge(createOfferOptionsSchemaOptionSchema<CustomOfferOptions>())
    .merge(ContractConfigOptionSchema)
    .merge(ProviderOptionSchema)
    .merge(ServerAddressOptionSchema)
    .strict();

// The protocol client initialization schema type
export type ClientOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createClientOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

export const NodeKeyJsonSchema = z
  .object({
    id: z.string(), // Peer Id
    privKey: z.string(), // Private key
    pubKey: z.string(), // Public key
  })
  .strict();

export type NodeKeyJson = z.infer<typeof NodeKeyJsonSchema>;

// Peer configuration options
export const PeerOptionsSchema = z
  .object({
    peerKey: NodeKeyJsonSchema.optional(), // Peer key
  })
  .strict();

export type PeerOptions = z.infer<typeof PeerOptionsSchema>;

// The protocol coordination server options schema
export const ServerOptionsSchema = PeerOptionsSchema.required()
  .extend({
    address: z.string().optional(), // Optional IP address of the server, defaults to '0.0.0.0'
    port: z.number(),
  })
  .strict();

// The protocol coordination server options type
export type ServerOptions = z.infer<typeof ServerOptionsSchema>;
