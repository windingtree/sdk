import { BigNumberish } from 'ethers';

/**
 * Smart contract configuration type
 */
export interface ContractConfig {
  /** Smart contract name */
  name: string;
  /** Internal smart contract version */
  version: string;
  /** Chain Id */
  chainId: BigNumberish;
  /** Smart contract address */
  address: string;
}
