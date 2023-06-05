/** Default message expiration time in seconds */
export const defaultExpirationTime = '1m';

/** Time to wait for outbound stream in milliseconds */
export const outboundStreamDelay = 250;

/** Time while the node accepting changes to request in seconds */
export const noncePeriod = '1s';

/** Number of queue jobs that can be stated at once */
export const queueConcurrentJobsNumber = 3;

/** Delay between repeats of failing jobs in milliseconds */
export const queueJobAttemptsDelay = 1000;

/** Time interval for queue needs in milliseconds */
export const queueHeartbeat = 5;

/**
 * Deal status
 */
export enum DealStatus {
  Created, // Just created
  Claimed, // Claimed by the supplier
  Rejected, // Rejected by the supplier
  Refunded, // Refunded by the supplier
  Cancelled, // Cancelled by the buyer
  CheckedIn, // Checked In
  CheckedOut, // Checked Out
  Disputed, // Dispute started
}
