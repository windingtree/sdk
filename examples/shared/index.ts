import { GenericQuery, GenericOfferOptions } from '../../src/shared/types.js';
import { ContractConfig } from '../../src/utils/contract.js';

export interface RequestQuery extends GenericQuery {
  greeting: string;
}

export interface OfferOptions extends GenericOfferOptions {
  date: string | null;
  buongiorno: boolean;
  buonasera: boolean;
}

export const contractConfig: ContractConfig = {
  name: 'WtMarket',
  version: '1',
  chainId: '1',
  address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
};

export const serverAddress =
  '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf';
