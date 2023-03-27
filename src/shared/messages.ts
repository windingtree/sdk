import { AbstractSigner, TypedDataField, getAddress, Signature } from 'ethers';
import { verifyTypedData } from '@ethersproject/wallet';
import { z } from 'zod';
import { ContractConfig, ContractConfigSchema } from '../utils/contract.js';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { nowSec, parseSeconds } from '../utils/time.js';
import * as regex from '../utils/regex.js';

// Basic message structure
export const GenericMessageSchema = z.object({
  id: z.string(), // Unique message Id
  expire: z.number().int().nonnegative(), // Expiration time in seconds
  nonce: z.number().int().nonnegative(), // A number that reflects the version of the message
});

// Generic message data type
export type GenericMessage = z.infer<typeof GenericMessageSchema>;

// Basic query is just an object with keys of unknown values
export const GenericQuerySchema = z.object({});

export type GenericQuery = z.infer<typeof GenericQuerySchema>;

// Request data structure
export const createRequestDataSchema = <T extends z.ZodTypeAny>(querySchema: T) =>
  GenericMessageSchema.extend({
    topic: z.string(),
    query: querySchema,
  }).strict();

// Request data type
export type RequestData<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestDataSchema<z.ZodType<CustomRequestQuery>>>
>;

export const createBuildRequestOptions = <T extends z.ZodTypeAny>(querySchema: T) =>
  z
    .object({
      expire: z.string().or(z.number()),
      nonce: z.number().int().nonnegative(),
      topic: z.string(),
      query: querySchema,
      querySchema: z.instanceof(z.ZodType),
      idOverride: z.string().optional(),
    })
    .strict();

export type BuildRequestOptions<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createBuildRequestOptions<z.ZodType<CustomRequestQuery>>>
>;

// Builds a request
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

// Offered payment option
export const PaymentOptionSchema = z
  .object({
    id: z.string(), // Unique payment option Id
    price: z.string(), // Asset price in WEI
    asset: z.string(), // ERC20 asset contract address
  })
  .strict();

export type PaymentOption = z.infer<typeof PaymentOptionSchema>;

// Offered cancellation option
export const CancelOptionSchema = z
  .object({
    time: z.number().int().nonnegative(), // Seconds before checkIn
    penalty: z.number().int().nonnegative(), // percents of total sum
  })
  .strict();

export type CancelOption = z.infer<typeof CancelOptionSchema>;

// Offer payload
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

export type UnsignedOfferPayload = z.infer<typeof UnsignedOfferPayloadSchema>;

// Generic offer is just an object with props
export const GenericOfferOptionsSchema = z.object({});

export type GenericOfferOptions = z.infer<typeof GenericOfferOptionsSchema>;

// Final offer data
export const createOfferDataSchema = <
  TQuery extends z.ZodTypeAny,
  TOfferOptions extends z.ZodTypeAny,
>(
  querySchema: TQuery,
  offerOptionsSchema: TOfferOptions,
) =>
  GenericMessageSchema.extend({
    request: createRequestDataSchema<TQuery>(querySchema), // Copy of request
    options: offerOptionsSchema, // Offer options
    payment: z.array(PaymentOptionSchema), // Payment options
    cancel: z.array(CancelOptionSchema), // Cancellation options
    payload: UnsignedOfferPayloadSchema, // Raw offer payload
    signature: z.string(), // EIP-712 TypedSignature(UnsignedOffer)
  }).strict();

export type OfferData<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<
    typeof createOfferDataSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>
  >
>;

// EIP-712 types for offer
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

export type BuildOfferOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<
    typeof createBuildOfferOptions<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>
  >
>;

// Builds an offer
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

// Verify signed offer
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
