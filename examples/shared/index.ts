import { Address } from 'viem';
import {
  GenericQuery,
  GenericOfferOptions,
  Contracts,
} from '@windingtree/sdk-types';

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
  typeof window === 'undefined'
    ? process.env
    : (import.meta as unknown as { env: LocalEnv }).env;

export const contractsConfig: Contracts =
  env.LOCAL_NODE === 'hardhat' || env.VITE_LOCAL_NODE === 'hardhat'
    ? {
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
      }
    : {
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

export const serverPeerKey = {
  id: 'QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf',
  privKey:
    'CAASpwkwggSjAgEAAoIBAQDMTbSxmM2ZRVLRoAEcHPRbdxUkpA3XC/xczDZ9P9rjEsWrkB8iMBeBeJfOc1VLjyQfKWc6nqQ3B9NzKbhvo5Zd2gj5W8VU48qLVDXjjF4hC/MjRTOQ3mXcxP586BlwjncVSYDiBI8IZxctFRejTueYL3T1YhJ8FcxAw3UCs2VaaB/zJIJCPhdY/oW1kxBQj4vXsY6EdQfV4yX7wv8Jy7DXWDm8Dp2AnWWT7/ZNpcKqmlLtDkWKvJQW/RJdeCsFznHZOlaJOdRHzl642FkC5exKIMrun6HgL9GA7fHRVg7LU0ZNMR0QSDEa8jgHfqSKAIaiDaVIRBGY0RHx7RduYabdAgMBAAECggEBALewNgJnzJM+DRSEs/q+3cVO8CediQQMtr4IrgU24GrBehCi6Bso+jliX7szX0EsVeHeq/28nRENbERjAnz9rDh9zQvGQ0nr9TQIZttMXWWBBP51PcPG8fbo95b+Z8EXlmIBUGvmhWOcrO3PxQ0D6J6gLJxjrRL71kV0d0QSX9JDqAd4Ut6h1PKvCDrO73IqG5OGrs7QRnFcHtWRlWKwMcFmblghsFcmxRyackBIt4naCxy/gIPZd2FVBBqabXOQCF7zGjBTVE9hbNdfhp4hNqQlcuT1bQLNryHPURznfc6o1m3nHfmKrdMhP618pWv41k9wYCL0eN7NJ6O+7jja4YECgYEA9b4vRkNyq1Ik8hul8R//OwJdRMU1ItAWbHQCfjl8TTkqkoHZMcXS6+QmMBFMNU0DCRcyt+Kxmf9OYjqlauZVlK1+vRFKdE5IeUtjPknPH2Oe7Lt0kHKUJRMbWHoiXgXnjFnYo3D0RBb4IguZ/2hQMnftgPMiDecUa5Q5vWVDcRUCgYEA1NS7kBxjCEFuq30MEBVKV9Rl/IdY91CenoRcg0wxeqeURfeY8cPU3c5OcgajTnrMC3hICmsNwsPh5UxG47jzc22dxfoTHo0KP54ZBoE8Yud2dF9yYVC2sDyu+mXHmlx2LvJmhG3Hh3dWlBYmfwkfl5vNhvmL5rpQIQkgZGBsAKkCgYAQEjYJRFP1fFPKOaCqmksY0tjCrJsDAdTVluiq1JuaeUideDx6EtPudWdB8X+oZLb0Gz5H5F11EstPhUJYMWQbaxVEzCKwZIY82H9PDYisJtm35bKD19p0akF5kdM5ju1LsnyGg9aVtWLY5yVVHL9R7aHssvnhKuGc/36fMkYs2QKBgGHhJBF2vKTDUt5TOAT9hZ8282Bb7rJuxUQpo1JO7EJ4Z1x2LkShx3fqtXEDVH93QffUbW09Jqr34x/NIJ0CJhRjyTePdtOKEbiIQQIY1Wi3AmcqrjPLJvmOLvrBbDa1ZzTYDgXBZw4J+CtKtJGf5IOZB8CXa5vE+6z1wYvoPENhAoGAdJGxooiJl+Mm9McuBu6b4A/LqVV0J3jF91wDjBWxdWgDtiV10+Vku7X7ZwS7nIZYJG8Q+0PWNb+FC7s4Z0jGmaMO/ZWbmHbJF/4hepl3E6nYqHOwGCFoY95Ca8mdxdRA4uiV/NrcpiMqyw9CeechOw6D+rjWGUv5H3tAsLABDzU=',
  pubKey:
    'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDMTbSxmM2ZRVLRoAEcHPRbdxUkpA3XC/xczDZ9P9rjEsWrkB8iMBeBeJfOc1VLjyQfKWc6nqQ3B9NzKbhvo5Zd2gj5W8VU48qLVDXjjF4hC/MjRTOQ3mXcxP586BlwjncVSYDiBI8IZxctFRejTueYL3T1YhJ8FcxAw3UCs2VaaB/zJIJCPhdY/oW1kxBQj4vXsY6EdQfV4yX7wv8Jy7DXWDm8Dp2AnWWT7/ZNpcKqmlLtDkWKvJQW/RJdeCsFznHZOlaJOdRHzl642FkC5exKIMrun6HgL9GA7fHRVg7LU0ZNMR0QSDEa8jgHfqSKAIaiDaVIRBGY0RHx7RduYabdAgMBAAE=',
} as const;
