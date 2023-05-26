import { Address } from 'viem';
import { GenericQuery, GenericOfferOptions } from '../../src/shared/types.js';
import { ProtocolChain } from '../../src/utils/contracts.js';

export interface RequestQuery extends GenericQuery {
  greeting: string;
}

export interface OfferOptions extends GenericOfferOptions {
  date: string | null;
  buongiorno: boolean;
  buonasera: boolean;
}

export const chainConfig: ProtocolChain = {
  chainId: 1442,
  contracts: {
    config: {
      name: 'Config',
      version: '1',
      address: '0x098b1d12cAfE7315C77b6d308A62ce02806260Ee',
    },
    entities: {
      name: 'EntitiesRegistry',
      version: '1',
      address: '0x4bB51528C83844b509E1152EEb05260eE1bf60e6',
    },
    market: {
      name: 'Market',
      version: '1',
      address: '0xDd5B6ffB3585E109ECddec5293e31cdc1e9DeD57',
    },
    token: {
      name: 'LifToken',
      version: '1',
      address: '0x4d60F4483BaA654CdAF1c5734D9E6B16735efCF8',
    },
  },
};

export const stableCoins: Record<string, Address> = {
  stable6: '0x8CB96383609C56af1Fe44DB7591F94AEE2fa43b2',
  stable6permit: '0x4556d5C1486d799f67FA96c84F1d0552486CAAF4',
  stable18: '0x4EcB659060Da61D795D777bb21BAe3599b301C66',
  stable18permit: '0xF54784206A53EF19fd3024D8cdc7A6251A4A0d67',
};

export const serverAddress =
  '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf';
