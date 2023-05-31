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

export interface LocalEnv {
  LOCAL_NODE?: string;
  VITE_LOCAL_NODE?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const env =
  typeof window === 'undefined' ? process.env : (import.meta as unknown as { env: LocalEnv }).env;

export const chainConfig: ProtocolChain =
  env.LOCAL_NODE === 'hardhat' || env.VITE_LOCAL_NODE === 'hardhat'
    ? {
        chainId: 31337, // Local Hardhat node
        chainName: 'hardhat',
        contracts: {
          config: {
            name: 'Config',
            version: '1',
            address: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
          },
          entities: {
            name: 'EntitiesRegistry',
            version: '1',
            address: '0x59b670e9fA9D0A427751Af201D676719a970857b',
          },
          market: {
            name: 'Market',
            version: '1',
            address: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
          },
          token: {
            name: 'LifToken',
            version: '1',
            address: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
          },
        },
      }
    : {
        chainId: 1442,
        chainName: 'zkSyncTestnet',
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

export const stableCoins: Record<string, Address> =
  env.LOCAL_NODE === 'hardhat' || env.VITE_LOCAL_NODE === 'hardhat'
    ? {
        stable6: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        stable6permit: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
        stable18: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
        stable18permit: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      }
    : {
        stable6: '0x8CB96383609C56af1Fe44DB7591F94AEE2fa43b2',
        stable6permit: '0x4556d5C1486d799f67FA96c84F1d0552486CAAF4',
        stable18: '0x4EcB659060Da61D795D777bb21BAe3599b301C66',
        stable18permit: '0xF54784206A53EF19fd3024D8cdc7A6251A4A0d67',
      };

export const serverAddress =
  '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf';
