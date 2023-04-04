/**
 * Allowed deal states
 */
export enum DealState {
  PENDING,
  ACCEPTED,
  REJECTED,
  CANCELLED,
  CHECKED_IN,
}

/**
 * Deal data type
 */
export interface DealData {
  /** NFT Id */
  tokenId: number;
  /** Supplier Id */
  supplierId: string;
  /** Deal status */
  status: DealState;
  /** Deal status change reason */
  reason?: string;
  /** Deal creation date */
  created: string;
  /** Deal update date */
  updated: string;
}
