import { z } from 'zod';

export const bigNumberishSchema = z.bigint().or(z.number()).or(z.string());

export const ContractConfigSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    chainId: bigNumberishSchema,
    address: z.string(),
  })
  .strict();

export type ContractConfig = z.infer<typeof ContractConfigSchema>;
