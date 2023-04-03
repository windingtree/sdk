import { AbstractSigner, TypedDataField, getAddress, Signature, verifyTypedData } from 'ethers';
import { z } from 'zod';
import { ContractConfig, ContractConfigSchema } from '../utils/contract.js';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { nowSec, parseSeconds } from '../utils/time.js';
import * as regex from '../utils/regex.js';

/**
 * Basic message structure
 */
export const GenericMessageSchema = z.object({
  /** Unique message Id */
  id: z.string(),
  /** Expiration time in seconds */
  expire: z.number().int().nonnegative(),
  /** A number that reflects the version of the message */
  nonce: z.number().int().nonnegative(),
});

/**
 * Generic message data type
 */
export type GenericMessage = z.infer<typeof GenericMessageSchema>;

/**
 * Basic query is just an object with keys of unknown values
 */
export const GenericQuerySchema = z.object({});

/**
 * Generic query type
 */
export type GenericQuery = z.infer<typeof GenericQuerySchema>;

/**
 * Creates request data structure schema
 *
 * @param {z.ZodType} querySchema
 * @returns {z.ZodType}
 */
export const createRequestDataSchema = <T extends z.ZodTypeAny>(querySchema: T) =>
  GenericMessageSchema.extend({
    /** Request topic */
    topic: z.string(),
    /** Custom query validation schema */
    query: querySchema,
  }).strict();

/**
 * Request data type
 */
export type RequestData<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestDataSchema<z.ZodType<CustomRequestQuery>>>
>;

/**
 * Creates schema for buildRequest method options
 *
 * @param {z.ZodType} querySchema
 * @returns {z.ZodType}
 */
export const createBuildRequestOptions = <T extends z.ZodTypeAny>(querySchema: T) =>
  z
    .object({
      /** Expiration time */
      expire: z.string().or(z.number().int().nonnegative()),
      /** Nonce */
      nonce: z.number().int().nonnegative(),
      /** Topic */
      topic: z.string(),
      /** Request query */
      query: querySchema,
      /** Request query schema */
      querySchema: z.instanceof(z.ZodType),
      /** If allowed request Id override */
      idOverride: z.string().optional(),
    })
    .strict();

/**
 * buildRequest method options type
 */
export type BuildRequestOptions<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createBuildRequestOptions<z.ZodType<CustomRequestQuery>>>
>;

/**
 * Builds a request
 *
 * @template CustomRequestQuery
 * @param {BuildRequestOptions<CustomRequestQuery>} requestOptions
 * @returns
 */
export const buildRequest = async <CustomRequestQuery extends GenericQuery>(
  requestOptions: BuildRequestOptions<CustomRequestQuery>,
) => {
  const { expire, nonce, topic, query, querySchema, idOverride } = createBuildRequestOptions<
    typeof requestOptions.querySchema
  >(requestOptions.querySchema).parse(requestOptions);
  const request = createRequestDataSchema<typeof querySchema>(querySchema);
  return (await request.parseAsync({
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce,
    topic,
    query,
  })) as unknown as RequestData<CustomRequestQuery>;
};

/**
 * Offered payment option schema
 */
export const PaymentOptionSchema = z
  .object({
    /** Unique payment option Id */
    id: z.string(),
    /** Asset price in WEI */
    price: z.string(),
    /** ERC20 asset contract address */
    asset: z.string(),
  })
  .strict();

/**
 * Offered payment option type
 */
export type PaymentOption = z.infer<typeof PaymentOptionSchema>;

/**
 * Offered cancellation option schema
 */
export const CancelOptionSchema = z
  .object({
    /** Seconds before checkIn */
    time: z.number().int().nonnegative(),
    /** Percents of total sum */
    penalty: z.number().int().nonnegative(),
  })
  .strict();

/**
 * Offered cancellation option type
 */
export type CancelOption = z.infer<typeof CancelOptionSchema>;

/**
 * Unsigned offer payload schema
 */
export const UnsignedOfferPayloadSchema = z
  .object({
    supplierId: z.string(), // Unique supplier Id registered on the protocol contract
    chainId: z.number().int().nonnegative(), // Target network chain Id
    requestHash: z.string().regex(regex.bytes32), // <keccak256(request.hash())>
    optionsHash: z.string().regex(regex.bytes32), // <keccak256(JSON.stringify(offer.options))>
    paymentHash: z.string().regex(regex.bytes32), // <keccak256(JSON.stringify(offer.payment))>
    cancelHash: z.string().regex(regex.bytes32), // <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))>
    transferable: z.boolean().default(true), // makes the deal NFT transferable or not
    checkIn: z.number().int().nonnegative(), // check-in time in seconds
  })
  .strict();

/**
 * Unsigned offer payload type
 */
export type UnsignedOfferPayload = z.infer<typeof UnsignedOfferPayloadSchema>;

/**
 * Generic offer is just an object with props schema
 */
export const GenericOfferOptionsSchema = z.object({});

/**
 * Generic offer is just an object with props type
 */
export type GenericOfferOptions = z.infer<typeof GenericOfferOptionsSchema>;

/**
 * Creates a final offer data schema
 *
 * @template TQuery
 * @template TOfferOptions
 * @param {TQuery} querySchema
 * @param {TOfferOptions} offerOptionsSchema
 */
export const createOfferDataSchema = <
  TQuery extends z.ZodTypeAny,
  TOfferOptions extends z.ZodTypeAny,
>(
  querySchema: TQuery,
  offerOptionsSchema: TOfferOptions,
) =>
  GenericMessageSchema.extend({
    /** Copy of request */
    request: createRequestDataSchema<TQuery>(querySchema),
    /** Offer options */
    options: offerOptionsSchema,
    /** Payment options */
    payment: z.array(PaymentOptionSchema),
    /** Cancellation options */
    cancel: z.array(CancelOptionSchema),
    /** Raw offer payload */
    payload: UnsignedOfferPayloadSchema,
    //** EIP-712 TypedSignature(UnsignedOffer) */
    signature: z.string(),
  }).strict();

/**
 * Offer data type
 */
export type OfferData<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<
    typeof createOfferDataSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>
  >
>;

/**
 * EIP-712 JSON schema types for offer
 */
export const offerEip712Types: Record<string, Array<TypedDataField>> = {
  Offer: [
    {
      name: 'supplierId',
      type: 'bytes32',
    },
    {
      name: 'chainId',
      type: 'uint256',
    },
    {
      name: 'requestHash',
      type: 'bytes32',
    },
    {
      name: 'optionsHash',
      type: 'bytes32',
    },
    {
      name: 'paymentHash',
      type: 'bytes32',
    },
    {
      name: 'cancelHash',
      type: 'bytes32',
    },
    {
      name: 'transferable',
      type: 'bool',
    },
    {
      name: 'checkIn',
      type: 'uint256',
    },
  ],
};

/**
 * Creates a schema for `buildOffer` method options
 *
 * @template TQuery
 * @template TOfferOptions
 * @param {TQuery} querySchema
 * @param {TOfferOptions} offerOptionsSchema
 */
export const createBuildOfferOptions = <
  TQuery extends z.ZodTypeAny,
  TOfferOptions extends z.ZodTypeAny,
>(
  querySchema: TQuery,
  offerOptionsSchema: TOfferOptions,
) =>
  z
    .object({
      contract: ContractConfigSchema,
      signer: z.instanceof(AbstractSigner).optional(),
      querySchema: z.instanceof(z.ZodType),
      optionsSchema: z.instanceof(z.ZodType),
      supplierId: z.string(),
      expire: z.string().or(z.number()),
      request: createRequestDataSchema<TQuery>(querySchema),
      options: offerOptionsSchema,
      payment: z.array(PaymentOptionSchema),
      cancel: z.array(CancelOptionSchema),
      checkIn: z.number().int().nonnegative(),
      transferable: z.boolean().default(true).optional(),
      idOverride: z.string().optional(),
      signatureOverride: z.string().optional(),
    })
    .strict();

/**
 * Type for `buildOffer` method options
 *
 * @template TQuery
 * @template TOfferOptions
 * @param {TQuery} querySchema
 * @param {TOfferOptions} offerOptionsSchema
 */
export type BuildOfferOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<
    typeof createBuildOfferOptions<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>
  >
>;

/**
 * Builds an offer
 *
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 * @param {BuildOfferOptions<CustomRequestQuery, CustomOfferOptions>} offerOptions
 * @returns
 */
export const buildOffer = async <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  offerOptions: BuildOfferOptions<CustomRequestQuery, CustomOfferOptions>,
) => {
  const {
    supplierId,
    contract,
    request,
    options,
    payment,
    cancel,
    checkIn,
    transferable,
    signer,
    signatureOverride,
    querySchema,
    optionsSchema,
    idOverride,
    expire,
  } = createBuildOfferOptions<typeof offerOptions.querySchema, typeof offerOptions.optionsSchema>(
    offerOptions.querySchema,
    offerOptions.optionsSchema,
  ).parse(offerOptions);

  const unsignedOfferPayload = UnsignedOfferPayloadSchema.parse({
    supplierId,
    chainId: Number(contract.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(options),
    paymentHash: hashObject(payment),
    cancelHash: hashObject(cancel),
    checkIn,
    transferable,
  });

  let signature: string | undefined;

  if (signer && !signatureOverride) {
    signature = await signer.signTypedData(
      {
        name: contract.name,
        version: contract.version,
        chainId: contract.chainId,
        verifyingContract: contract.address,
      },
      offerEip712Types,
      unsignedOfferPayload,
    );
  } else if (signatureOverride) {
    signature = signatureOverride;
  } else {
    throw new Error('Either signer or signatureOverride must be provided');
  }

  const offerSchema = createOfferDataSchema<
    typeof offerOptions.querySchema,
    typeof offerOptions.optionsSchema
  >(querySchema, optionsSchema);

  return (await offerSchema.parseAsync({
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce: 1,
    request,
    options,
    payment,
    cancel,
    payload: unsignedOfferPayload,
    signature,
  })) as unknown as OfferData<CustomRequestQuery, CustomOfferOptions>;
};

/**
 * Verifies signed offer
 *
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 * @param {ContractConfig} contract
 * @param {string} supplierAddress
 * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
 */
export const verifyOffer = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  contract: ContractConfig,
  supplierAddress: string,
  offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
): void => {
  supplierAddress = getAddress(supplierAddress);
  const recoveredAddress = verifyTypedData(
    {
      name: contract.name,
      version: contract.version,
      chainId: contract.chainId,
      verifyingContract: contract.address,
    },
    offerEip712Types,
    offer.payload,
    Signature.from(offer.signature),
  );

  if (recoveredAddress !== supplierAddress) {
    throw new Error(`Invalid offer signer ${supplierAddress}`);
  }
};
