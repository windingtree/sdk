import { router, procedure } from '../index.js';
import { createLogger } from '../../../../../packages/logger/src/index.js';

const logger = createLogger('ServiceRouter');

/**
 * A router defining procedures for user management.
 */
export const serviceRouter = router({
  /**
   * Ping-pong.
   */
  ping: procedure.query(() => {
    logger.trace(`Ping at ${new Date().toISOString()}`);
    return {
      message: 'pong',
    };
  }),
});
