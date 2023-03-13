import { AbstractSigner, TypedDataField, getAddress, Signature } from 'ethers';
import { verifyTypedData } from '@ethersproject/wallet';
import { z, ZodType } from 'zod';
import { ContractConfig, ContractConfigSchema } from '../utils/contract.js';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { nowSec, parseSeconds } from '../utils/time.js';

// Basic message structure
export const GenericMessageSchema = z.object({
  id: z.string(), // Unique message Id
  expire: z.number(), // Expiration time in seconds
  nonce: z.number(), // A number that reflects the version of the message
});

// Generic message data type
export type GenericMessage = z.infer<typeof GenericMessageSchema>;

// Basic query is just an object with keys of unknown values
export const GenericQuerySchema = z.object({}).catchall(z.unknown());

export type GenericQuery = z.infer<typeof GenericQuerySchema>;

// Request data structure
export const createRequestDataSchema = <CustomRequestQuery extends GenericQuery>(
  querySchema: z.ZodType<CustomRequestQuery>,
) =>
  GenericMessageSchema.extend({
    query: querySchema,
  }).strict();

// Request data type
export type RequestData<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestDataSchema<CustomRequestQuery>>
>;

// Builds a request
export const buildRequest = async <CustomRequestQuery extends GenericQuery>(
  expire: string | number,
  nonce: number,
  query: CustomRequestQuery,
  querySchema: z.ZodType<CustomRequestQuery>,
  idOverride?: string,
): Promise<RequestData<CustomRequestQuery>> => {
  const request = createRequestDataSchema<CustomRequestQuery>(querySchema);
  return await request.parseAsync({
    id: idOverride ?? uuid4(),
    expire: typeof expire === 'number' ? parseSeconds(expire) : nowSec() + parseSeconds(expire),
    nonce,
    query,
  });
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
    time: z.number(), // Seconds before checkIn
    penalty: z.number(), // percents of total sum
  })
  .strict();

export type CancelOption = z.infer<typeof CancelOptionSchema>;

// Offer payload
export const UnsignedOfferPayloadSchema = z
  .object({
    supplierId: z.string(), // Unique supplier Id registered on the protocol contract
    chainId: z.number(), // Target network chain Id
    requestHash: z.string(), // <keccak256(request.hash())>
    optionsHash: z.string(), // <keccak256(JSON.stringify(offer.options))>
    paymentHash: z.string(), // <keccak256(JSON.stringify(offer.payment))>
    cancelHash: z.string(), // <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))>
    transferable: z.boolean(), // makes the deal NFT transferable or not
    checkIn: z.number(), // check-in time in seconds
  })
  .strict();

export type UnsignedOfferPayload = z.infer<typeof UnsignedOfferPayloadSchema>;

// Generic offer is just an object with props
export const GenericOfferOptionsSchema = z.object({}).catchall(z.unknown());

export type GenericOfferOptions = z.infer<typeof GenericOfferOptionsSchema>;

// Final offer data
export const createOfferDataSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  querySchema: z.ZodType<CustomRequestQuery>,
  optionsSchema: z.ZodType<CustomOfferOptions>,
) =>
  GenericMessageSchema.extend({
    request: createRequestDataSchema<CustomRequestQuery>(querySchema), // Copy of request
    options: optionsSchema, // Offer options
    payment: z.array(PaymentOptionSchema), // Payment options
    cancel: z.array(CancelOptionSchema), // Cancellation options
    payload: UnsignedOfferPayloadSchema, // Raw offer payload
    signature: z.string(), // EIP-712 TypedSignature(UnsignedOffer)
  }).strict();

export type OfferData<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createOfferDataSchema<CustomRequestQuery, CustomOfferOptions>>>;

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

// Builds an offer
export const buildOffer = async <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  contract: ContractConfig,
  signer: AbstractSigner | undefined,
  querySchema: z.ZodType<CustomRequestQuery>,
  optionsSchema: z.ZodType<CustomOfferOptions>,
  supplierId: string,
  expire: string | number,
  request: RequestData<CustomRequestQuery>,
  options: CustomOfferOptions,
  payment: PaymentOption[],
  cancel: CancelOption[],
  checkIn: number,
  transferable = true,
  idOverride?: string,
  signatureOverride?: string,
): Promise<OfferData<CustomRequestQuery, CustomOfferOptions>> => {
  // @todo Move all arguments to the options object and validate it with monolith schema
  contract = ContractConfigSchema.parse(contract);
  signer = z.instanceof(AbstractSigner).optional().parse(signer);
  expire = parseSeconds(expire);
  supplierId = z.string().parse(supplierId);
  querySchema = z.instanceof(ZodType<CustomRequestQuery>).parse(querySchema);
  optionsSchema = z.instanceof(ZodType<CustomOfferOptions>).parse(optionsSchema);
  request = createRequestDataSchema(querySchema).parse(request);
  options = optionsSchema.parse(options);
  payment = z.array(PaymentOptionSchema).parse(payment);
  cancel = z.array(CancelOptionSchema).parse(cancel);
  checkIn = z.number().parse(checkIn);
  transferable = z.boolean().parse(transferable);
  idOverride = z.string().optional().parse(idOverride);
  signatureOverride = z.string().optional().parse(signatureOverride);

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

  const offerSchema = createOfferDataSchema<CustomRequestQuery, CustomOfferOptions>(querySchema, optionsSchema);

  return await offerSchema.parseAsync({
    id: idOverride ?? uuid4(),
    expire,
    nonce: 1,
    request,
    options,
    payment,
    cancel,
    payload: unsignedOfferPayload,
    signature,
  });
};

// Verify signed offer
export const verifyOffer = <CustomRequestQuery extends GenericQuery, CustomOfferOptions extends GenericOfferOptions>(
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
