import { z } from 'zod';

/**
 * BigNumberish schema
 */
export const bigNumberishSchema = z.bigint().or(z.number()).or(z.string());

/**
 * Smart contract configuration schema
 */
export const ContractConfigSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    chainId: bigNumberishSchema,
    address: z.string(),
  })
  .strict();

/**
 * Smart contract configuration type
 */
export type ContractConfig = z.infer<typeof ContractConfigSchema>;
