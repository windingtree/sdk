import { z } from 'zod';

/**
 * Allowed deal states
 */
export enum DealStates {
  PENDING,
  ACCEPTED,
  REJECTED,
  CANCELLED,
  CHECKED_IN,
}

/**
 * Deal state schema
 */
export const DealStateSchema = z.nativeEnum(DealStates);

/**
 * Deals state type
 */
export type DealState = z.infer<typeof DealStateSchema>;

/**
 * Deal data schema
 */
export const DealDataSchema = z
  .object({
    /** NFT Id */
    tokenId: z.number().int().nonnegative(),
    /** Supplier Id */
    supplierId: z.string(),
    /** Deal status */
    status: DealStateSchema,
    /** Deal status change reason */
    reason: z.string().optional(),
    /** Deal creation date */
    created: z.string(),
    /** Deal update date */
    updated: z.string(),
  })
  .strict();

/**
 * Deal data type
 */
export type DealData = z.infer<typeof DealDataSchema>;
