import { Hash } from 'viem';
import { DealStatus } from './contracts.js';

/**
 * Deal data type
 */
export interface DealData {
  /** NFT Id */
  tokenId: number;
  /** Supplier Id */
  supplierId: Hash;
  /** Deal status */
  status: DealStatus;
  /** Deal status change reason */
  reason?: string;
  /** Deal creation date */
  created: string;
  /** Deal update date */
  updated: string;
}
