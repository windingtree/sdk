import { AbstractSigner, TypedDataField, getAddress, Signature } from 'ethers';
import { verifyTypedData } from '@ethersproject/wallet';
import { Type, Static, TSchema, TypeGuard } from '@sinclair/typebox';
import { TypeSystem } from '@sinclair/typebox/system';
import { Value } from '@sinclair/typebox/value';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { nowSec, parseSeconds } from '../utils/time.js';
import * as regex from '../utils/regex.js';

const TSchema = TypeSystem.Type<TSchema>('TSchema', (_, value) => TypeGuard.TSchema(value));

const InstanceOfSigner = TypeSystem.Type<AbstractSigner>('InstanceOfSigner', (_, value) => {
  return value instanceof AbstractSigner;
});

const ExpireType = Type.Union([Type.String(), Type.Number()]);

// Basic message structure
export const GenericMessageSchema = Type.Object({
  id: Type.String(), // Unique message Id
  expire: Type.Number(), // Expiration time in seconds
  nonce: Type.Number(), // A number that reflects the version of the message
});

// Generic message data type
export type GenericMessage = Static<typeof GenericMessageSchema>;

// Basic query is just an object with keys of unknown values
export const GenericQuerySchema = Type.Object({});

export type GenericQuery = Static<typeof GenericQuerySchema>;

// Request data structure
export const createRequestDataSchema = <CustomRequestQuerySchema extends TSchema>(
  querySchema: CustomRequestQuerySchema,
) =>
  Type.Composite([
    GenericMessageSchema,
    Type.Object({
      query: querySchema,
    }),
  ]);

// Request data type
export type RequestData<CustomRequestQuerySchema extends TSchema> = Static<
  ReturnType<typeof createRequestDataSchema<CustomRequestQuerySchema>>
>;

export const createBuildRequestOptions = <CustomRequestQuerySchema extends TSchema>(
  querySchema: CustomRequestQuerySchema,
) =>
  Type.Object({
    expire: ExpireType,
    nonce: Type.Number(),
    query: querySchema,
    querySchema: TSchema(),
    idOverride: Type.Optional(Type.String()),
  });

export type BuildRequestOptions<CustomRequestQuerySchema extends TSchema> = Static<
  ReturnType<typeof createBuildRequestOptions<CustomRequestQuerySchema>>
>;

// Builds a request
export const buildRequest = async <
  CustomRequestQuerySchema extends TSchema,
  Options extends BuildRequestOptions<TSchema>,
>(
  requestOptions: Options,
) => {
  const optionsSchema = createBuildRequestOptions<typeof requestOptions.querySchema>(
    requestOptions.querySchema,
  );

  if (!Value.Check(optionsSchema, requestOptions)) {
    throw new Error(
      Value.Errors(optionsSchema, requestOptions).First()?.message ?? 'Unknown error',
    );
  }

  const { expire, nonce, query, querySchema, idOverride } = Value.Cast(
    optionsSchema,
    requestOptions,
  );

  const requestSchema = createRequestDataSchema<typeof querySchema>(querySchema);
  const request: RequestData<typeof querySchema> = {
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce,
    query,
  };

  if (!Value.Check(requestSchema, request)) {
    throw new Error(Value.Errors(requestSchema, request).First()?.message ?? 'Unknown error');
  }

  return Promise.resolve(request) as unknown as Promise<RequestData<CustomRequestQuerySchema>>;
};

// Offered payment option
export const PaymentOptionSchema = Type.Object({
  id: Type.String(), // Unique payment option Id
  price: Type.String(), // Asset price in WEI
  asset: Type.String(), // ERC20 asset contract address
});

export type PaymentOption = Static<typeof PaymentOptionSchema>;

// Offered cancellation option
export const CancelOptionSchema = Type.Object({
  time: Type.Number(), // Seconds before checkIn
  penalty: Type.Number(), // percents of total sum
});

export type CancelOption = Static<typeof CancelOptionSchema>;

// Offer payload
export const UnsignedOfferPayloadSchema = Type.Object({
  supplierId: Type.String(), // Unique supplier Id registered on the protocol contract
  chainId: Type.Number(), // Target network chain Id
  requestHash: Type.String({ regex: regex.bytes32 }), // <keccak256(request.hash())>
  optionsHash: Type.String({ regex: regex.bytes32 }), // <keccak256(JSON.stringify(offer.options))>
  paymentHash: Type.String({ regex: regex.bytes32 }), // <keccak256(JSON.stringify(offer.payment))>
  cancelHash: Type.String({ regex: regex.bytes32 }), // <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))>
  transferable: Type.Boolean({ default: true }), // makes the deal NFT transferable or not
  checkIn: Type.Number(), // check-in time in seconds
});

export type UnsignedOfferPayload = Static<typeof UnsignedOfferPayloadSchema>;

// Generic offer is just an object with props
export const GenericOfferOptionsSchema = Type.Object({});

export type GenericOfferOptions = Static<typeof GenericOfferOptionsSchema>;

// Final offer data
export const createOfferDataSchema = <
  CustomRequestQuerySchema extends TSchema,
  CustomOfferOptionsSchema extends TSchema,
>(
  querySchema: CustomRequestQuerySchema,
  optionsSchema: CustomOfferOptionsSchema,
) =>
  Type.Composite([
    GenericMessageSchema,
    Type.Object({
      request: createRequestDataSchema<CustomRequestQuerySchema>(querySchema), // Copy of request
      options: optionsSchema, // Offer options
      payment: Type.Array(PaymentOptionSchema), // Payment options
      cancel: Type.Array(CancelOptionSchema), // Cancellation options
      payload: UnsignedOfferPayloadSchema, // Raw offer payload
      signature: Type.String(), // EIP-712 TypedSignature(UnsignedOffer)
    }),
  ]);

export type OfferData<
  CustomRequestQuerySchema extends TSchema,
  CustomOfferOptionsSchema extends TSchema,
> = Static<
  ReturnType<typeof createOfferDataSchema<CustomRequestQuerySchema, CustomOfferOptionsSchema>>
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

export const BigNumberishSchema = Type.Union([Type.BigInt(), Type.Number(), Type.String()]);

export const ContractConfigSchema = Type.Object({
  name: Type.String(),
  version: Type.String(),
  chainId: BigNumberishSchema,
  address: Type.String(),
});

export type ContractConfig = Static<typeof ContractConfigSchema>;

export const createBuildOfferOptions = <
  CustomRequestQuerySchema extends TSchema,
  CustomOfferOptionsSchema extends TSchema,
>(
  querySchema: CustomRequestQuerySchema,
  optionsSchema: CustomOfferOptionsSchema,
) =>
  Type.Object({
    contract: ContractConfigSchema,
    signer: Type.Optional(InstanceOfSigner({ default: null })),
    querySchema: TSchema(),
    optionsSchema: TSchema(),
    supplierId: Type.String(),
    expire: ExpireType,
    request: createRequestDataSchema<CustomRequestQuerySchema>(querySchema),
    options: optionsSchema,
    payment: Type.Array(PaymentOptionSchema),
    cancel: Type.Array(CancelOptionSchema),
    checkIn: Type.Number(),
    transferable: Type.Boolean({ default: true }),
    idOverride: Type.Optional(Type.String()),
    signatureOverride: Type.Optional(Type.String()),
  });

export type BuildOfferOptions<
  CustomRequestQuerySchema extends TSchema,
  CustomOfferOptionsSchema extends TSchema,
> = Static<
  ReturnType<typeof createBuildOfferOptions<CustomRequestQuerySchema, CustomOfferOptionsSchema>>
>;

// Builds an offer
export const buildOffer = async <
  CustomRequestQuerySchema extends TSchema,
  CustomOfferOptionsSchema extends TSchema,
  Options extends BuildOfferOptions<TSchema, TSchema>,
>(
  offerOptions: Options,
) => {
  const optsSchema = createBuildOfferOptions<
    typeof offerOptions.querySchema,
    typeof offerOptions.optionsSchema
  >(offerOptions.querySchema, offerOptions.optionsSchema);

  if (!Value.Check(optsSchema, offerOptions)) {
    throw new Error(Value.Errors(optsSchema, offerOptions).First()?.message ?? 'Unknown error');
  }

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
  } = Value.Cast(optsSchema, offerOptions);

  const unsignedOfferPayload: UnsignedOfferPayload = {
    supplierId,
    chainId: Number(contract.chainId),
    requestHash: hashObject(request),
    optionsHash: hashObject(options),
    paymentHash: hashObject(payment),
    cancelHash: hashObject(cancel),
    checkIn,
    transferable,
  };

  if (!Value.Check(UnsignedOfferPayloadSchema, unsignedOfferPayload)) {
    throw new Error(
      Value.Errors(UnsignedOfferPayloadSchema, unsignedOfferPayload).First()?.message ??
        'Unknown error',
    );
  }

  let signature: string;

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

  const offerSchema = createOfferDataSchema<typeof querySchema, typeof optionsSchema>(
    querySchema,
    optionsSchema,
  );

  const offer: OfferData<typeof querySchema, typeof optionsSchema> = {
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce: 1,
    request,
    options,
    payment,
    cancel,
    payload: unsignedOfferPayload,
    signature,
  };

  if (!Value.Check(offerSchema, offer)) {
    throw new Error(Value.Errors(offerSchema, offer).First()?.message ?? 'Unknown error');
  }

  return offer as unknown as OfferData<CustomRequestQuerySchema, CustomOfferOptionsSchema>;
};

// Verify signed offer
export const verifyOffer = <OfferDataType extends OfferData<TSchema, TSchema>>(
  contract: ContractConfig,
  supplierAddress: string,
  offer: OfferDataType,
): void => {
  supplierAddress = getAddress(supplierAddress);
  offer;
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
