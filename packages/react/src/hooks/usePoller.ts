import { useEffect } from 'react';
import { createLogger } from '@windingtree/sdk-logger';

// Initialize a logger for the hook
const logger = createLogger('usePoller');

/**
 * Custom React hook for running a function at regular intervals.
 *
 * @param fn - The function to be executed periodically.
 * @param delay - The delay (in milliseconds) between each execution.
 * @param enabled - Boolean to enable or disable the polling.
 * @param name - Name of the poller for logging purposes.
 * @param maxFailures - Maximum number of allowed consecutive failures.
 */
export const usePoller = (
  fn: () => void,
  delay: number | null,
  enabled = true,
  name = ' ',
  maxFailures = 100,
): void => {
  useEffect(() => {
    let failures = 0;
    let intervalId: ReturnType<typeof setInterval>;

    // Check if the poller should be running.
    if (enabled && delay !== null && failures < maxFailures) {
      // Function to be run at each interval.
      const fnRunner = async (): Promise<void> => {
        try {
          // Execute the provided function.
          const context = fn();
          // Wait for the function if it returns a Promise.
          await Promise.resolve(context);
        } catch (error) {
          // Increment failure count and log error.
          failures++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Poller ${name} error: ${errorMessage}`);
        }
      };

      // Setting up the interval.
      intervalId = setInterval(fnRunner, delay);
      logger.trace(`Poller ${name} started`);
    }

    // Cleanup function for the useEffect.
    return () => {
      // Clear the interval when the component is unmounted or dependencies change.
      if (intervalId) {
        clearInterval(intervalId);
      }
      logger.trace(`Poller ${name} stopped`);
    };
  }, [fn, delay, name, enabled, maxFailures]);
};
