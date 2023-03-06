import { Signer, TypedDataField, getAddress, Signature } from 'ethers';
import { verifyTypedData } from '@ethersproject/wallet';
import { z } from 'zod';
import { ContractConfig } from '../utils/contract.js';
import { hashObject } from '../utils/hash.js';
import { uuid4 } from '../utils/uid.js';
import { parseSeconds } from '../utils/time.js';

// Basic message structure
export const GenericMessageSchema = z
  .object({
    id: z.string(), // Unique message Id
    expire: z.number(), // Expiration time in seconds
    nonce: z.number().optional(), // A number that reflects the version of the message
  })
  .strict();

export type GenericMessage = z.infer<typeof GenericMessageSchema>;

// Basic query is just an object with keys of unknown values
export const GenericQuerySchema = z.object({});

export type GenericQuery = z.infer<typeof GenericQuerySchema>;

// Request data structure
export const createRequestDataSchema = <CustomRequestQuery extends GenericQuery>(
  querySchema: z.ZodType<CustomRequestQuery>,
) =>
  GenericMessageSchema.extend({
    query: querySchema,
  }).strict();

export type RequestData<CustomRequestQuery extends GenericQuery> = z.infer<
  ReturnType<typeof createRequestDataSchema<CustomRequestQuery>>
>;

// Builds a request
export const buildRequest = async <CustomRequestQuery extends GenericQuery>(
  expire: string | number,
  nonce: number,
  query: CustomRequestQuery,
  querySchema: z.ZodType<CustomRequestQuery>,
): Promise<RequestData<CustomRequestQuery>> => {
  const request = createRequestDataSchema<CustomRequestQuery>(querySchema);
  return await request.parseAsync({
    id: uuid4(),
    expire: parseSeconds(expire),
    nonce,
    query,
  });
};

// Offered payment option
export const PaymentOption = z
  .object({
    id: z.string(), // Unique payment option Id
    price: z.string(), // Asset price in WEI
    asset: z.string(), // ERC20 asset contract address
  })
  .strict();

export type PaymentOption = z.infer<typeof PaymentOption>;

// Offered cancellation option
export const CancelOption = z
  .object({
    time: z.number(), // Seconds before checkIn
    penalty: z.number(), // percents of total sum
  })
  .strict();

export type CancelOption = z.infer<typeof CancelOption>;

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
export const GenericOfferOptionsSchema = z.object({});

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
    payment: z.array(PaymentOption), // Payment options
    cancel: z.array(CancelOption), // Cancellation options
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
  signer: Signer,
  expire: string | number,
  supplierId: string,
  request: RequestData<CustomRequestQuery>,
  options: CustomOfferOptions,
  payment: PaymentOption[],
  cancel: CancelOption[],
  checkIn: number,
  transferable = true,
  querySchema: z.ZodType<CustomRequestQuery>,
  optionsSchema: z.ZodType<CustomOfferOptions>,
): Promise<OfferData<CustomRequestQuery, CustomOfferOptions>> => {
  expire = parseSeconds(expire);

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

  const signature = await signer.signTypedData(
    {
      name: contract.name,
      version: contract.version,
      chainId: contract.chainId,
      verifyingContract: contract.address,
    },
    offerEip712Types,
    unsignedOfferPayload,
  );

  const offerSchema = createOfferDataSchema<CustomRequestQuery, CustomOfferOptions>(querySchema, optionsSchema);

  return await offerSchema.parseAsync({
    id: uuid4(),
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
