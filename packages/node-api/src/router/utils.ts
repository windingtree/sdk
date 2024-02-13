import { z } from 'zod';

export const PaginationInputSchema = z.object({
  start: z.number().int().gte(0).optional(),
  skip: z.number().int().gte(0).optional(),
});
