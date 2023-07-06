import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authProcedure, withDeals, withContracts } from '../index.js';
import { PaginationInputSchema } from './utils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('AdminRouter');

/**
 * Hash string validation schema
 */
export const HashSchema = z.custom<`0x${string}`>((val) =>
  z.string().startsWith(`0x`).parse(val),
);

export const DealsGetInputSchema = z.object({
  id: HashSchema,
});

export const DealsCheckInInputSchema = z.object({
  id: HashSchema,
  signs: HashSchema.array().nonempty().min(1).max(2),
});

export const dealsRouter = router({
  /**
   * Returns all deals
   */
  getAll: authProcedure
    .use(withDeals)
    .input(PaginationInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { deals } = ctx;
        return await deals.getAll(input);
      } catch (error) {
        logger.error('deals.getAll', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Returns a specific deal by Id
   */
  get: authProcedure
    .use(withDeals)
    .input(DealsGetInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id } = input;
        const { deals } = ctx;
        return await deals.get(id);
      } catch (error) {
        logger.error('deals.get', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Check in the deal
   */
  checkIn: authProcedure
    .use(withDeals.unstable_pipe(withContracts))
    .input(DealsCheckInInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id, signs } = input;
        const { deals, contracts } = ctx;
        const deal = await deals.get(id);
        let hash: string | undefined;
        const receipt = await contracts.checkInDeal(
          deal.offer,
          signs,
          undefined,
          (txHash) => {
            hash = txHash;
          },
        );
        return {
          hash,
          receipt,
        };
      } catch (error) {
        logger.error('user.register', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Check out the deal
   */
  checkOut: authProcedure
    .use(withDeals.unstable_pipe(withContracts))
    .input(DealsGetInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id } = input;
        const { deals, contracts } = ctx;
        const deal = await deals.get(id);
        let hash: string | undefined;
        const receipt = await contracts.checkOutDeal(
          deal.offer,
          undefined,
          (txHash) => {
            hash = txHash;
          },
        );
        return {
          hash,
          receipt,
        };
      } catch (error) {
        logger.error('user.register', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),
});
