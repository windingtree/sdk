import { router } from '../server.js';
import { serviceRouter } from './service.js';
import { userRouter } from './user.js';
import { adminRouter } from './admin.js';
import { dealsRouter } from './deals.js';

export * from './admin.js';
export * from './user.js';
export * from './deals.js';

/**
 * The Node API router
 */
export const appRouter = router({
  service: serviceRouter,
  admin: adminRouter,
  user: userRouter,
  deals: dealsRouter,
});

/**
 * The Node API router type
 */
export type AppRouter = typeof appRouter;
