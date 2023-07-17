import { z } from 'zod';

export const PaginationInputSchema = z.object({
  start: z.number().int().positive().optional(),
  skip: z.number().int().positive().optional(),
});
