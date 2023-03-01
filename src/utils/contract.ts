import { BigNumberish } from 'ethers';

export interface ContractConfig {
  name: string;
  version: string;
  chainId: BigNumberish;
  address: string;
}
