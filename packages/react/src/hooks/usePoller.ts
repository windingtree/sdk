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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Schedules the next execution of fnRunner
    const scheduleNextRun = () => {
      if (enabled && delay !== null) {
        timeoutId = setTimeout(fnRunner, delay);
      }
    };

    // Function to be executed at each interval
    const fnRunner = async (): Promise<void> => {
      if (failures >= maxFailures) {
        // Stop polling after reaching maximum failures
        logger.error(`Poller ${name} stopped after reaching max failures`);
        return;
      }

      try {
        // Execute the provided function
        await Promise.resolve(fn());
        // Schedule the next run after successful execution
        scheduleNextRun();
      } catch (error) {
        failures++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Poller ${name} error: ${errorMessage}`);
        // Schedule the next run even if an error occurred
        scheduleNextRun();
      }
    };

    if (enabled) {
      // Start the initial run
      scheduleNextRun();
    }

    // Cleanup function for useEffect
    return () => {
      if (timeoutId) {
        // Clear the timeout when the component is unmounted or dependencies change
        clearTimeout(timeoutId);
      }
      logger.trace(`Poller ${name} stopped`);
    };
  }, [fn, delay, name, enabled, maxFailures]);
};
