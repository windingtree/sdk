import { z } from 'zod';

export enum DealStates {
  PENDING,
  ACCEPTED,
  REJECTED,
  CANCELLED,
  CHECKED_IN,
}

export const DealStateSchema = z.nativeEnum(DealStates);

export type DealState = z.infer<typeof DealStateSchema>;

export const DealDataSchema = z
  .object({
    tokenId: z.number(),
    supplierId: z.string(),
    status: DealStateSchema,
    reason: z.string().optional(),
    created: z.string(),
    updated: z.string(),
  })
  .strict();

export type DealData = z.infer<typeof DealDataSchema>;
