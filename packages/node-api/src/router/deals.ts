import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { DealRecord, DealStatus, RequestData } from '@windingtree/sdk-types';
import { Account, createCheckInOutSignature } from '@windingtree/sdk-messages';
import { router, authProcedure, withDeals, withContracts } from '../server.js';
import { PaginationInputSchema } from './utils.js';
import { createLogger } from '@windingtree/sdk-logger';

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
  sign: HashSchema.optional(),
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
        /* c8 ignore next 7 */
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
    .mutation(async ({ input, ctx }) => {
      /* c8 ignore next 77 */
      try {
        const { id, sign } = input;
        const { deals, contracts } = ctx;

        let deal: DealRecord;

        try {
          deal = await deals.get(id);
        } catch (error) {
          logger.error(error);

          const [created, payload, retailerId, buyer, price, asset, status] =
            await contracts.getDeal(id);

          // Using fake offer details for unsaved offer
          // This approach should not affect the possibility to checkIn/out etc
          deal = {
            chainId: Number(payload.chainId),
            created,
            offer: {
              id,
              nonce: BigInt(1),
              expire: payload.expire,
              request: {} as RequestData,
              options: {},
              payment: [],
              cancel: [],
              payload,
              signature: '0xUnknown',
            },
            retailerId,
            buyer,
            price,
            asset,
            status,
          };
        }

        if (!contracts.walletClient || !contracts.walletClient.account) {
          throw new Error('Invalid signer configuration');
        }

        const systemSign = await createCheckInOutSignature({
          offerId: deal.offer.id,
          domain: {
            chainId: Number(deal.offer.payload.chainId),
            name: contracts.contracts.market.name,
            version: contracts.contracts.market.version,
            verifyingContract: contracts.contracts.market.address,
          },
          account: contracts.walletClient.account as Account,
        });

        let hash: string | undefined;
        const receipt = await contracts.checkInDeal(
          deal.offer,
          [systemSign, ...(sign ? [sign] : [])],
          undefined,
          (txHash) => {
            hash = txHash;
          },
        );

        deal.status = DealStatus.CheckedIn;
        await deals.set(deal);

        return {
          hash,
          receipt,
        };
      } catch (error) {
        logger.error('deals.checkIn', error);
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
    .mutation(async ({ input, ctx }) => {
      /* c8 ignore next 61 */
      try {
        const { id } = input;
        const { deals, contracts } = ctx;

        let deal: DealRecord;

        try {
          deal = await deals.get(id);
        } catch (error) {
          logger.error(error);

          const [created, payload, retailerId, buyer, price, asset, status] =
            await contracts.getDeal(id);

          // Using fake offer details for unsaved offer
          // This approach should not affect the possibility to checkIn/out etc
          deal = {
            chainId: Number(payload.chainId),
            created,
            offer: {
              id,
              nonce: BigInt(1),
              expire: payload.expire,
              request: {} as RequestData,
              options: {},
              payment: [],
              cancel: [],
              payload,
              signature: '0xUnknown',
            },
            retailerId,
            buyer,
            price,
            asset,
            status,
          };
        }

        let hash: string | undefined;
        const receipt = await contracts.checkOutDeal(
          deal.offer,
          undefined,
          (txHash) => {
            hash = txHash;
          },
        );

        deal.status = DealStatus.CheckedOut;
        await deals.set(deal);

        return {
          hash,
          receipt,
        };
      } catch (error) {
        logger.error('deals.checkOut', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),

  /**
   * Check the deal in the contract and updates the database record
   */
  seek: authProcedure
    .use(withDeals.unstable_pipe(withContracts))
    .input(DealsGetInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id } = input;
        const { deals, contracts } = ctx;

        const [created, payload, retailerId, buyer, price, asset, status] =
          await contracts.getDeal(id);

        let deal: DealRecord;

        try {
          deal = await deals.get(id);
          deal.status = status;
        } catch (error) {
          logger.error(error);

          // Using fake offer details for unsaved offer
          // This approach should not affect the possibility to checkIn/out etc
          deal = {
            chainId: Number(payload.chainId),
            created,
            offer: {
              id,
              nonce: BigInt(1),
              expire: payload.expire,
              request: {} as RequestData,
              options: {},
              payment: [],
              cancel: [],
              payload,
              signature: '0xUnknown',
            },
            retailerId,
            buyer,
            price,
            asset,
            status,
          };
        }

        await deals.set(deal);

        return deal;
        /* c8 ignore next 7 */
      } catch (error) {
        logger.error('deals.seek', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (error as Error).message,
        });
      }
    }),
});
