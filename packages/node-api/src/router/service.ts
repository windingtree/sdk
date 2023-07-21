import { router, procedure } from '../server.js';
import { createLogger } from '@windingtree/sdk-logger';

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
