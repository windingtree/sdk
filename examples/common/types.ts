import { z } from 'zod';
import { ContractConfig } from '../../src/utils/contract.js';

export const RequestQuerySchema = z
  .object({
    greeting: z.string(),
  })
  .strict();

export type RequestQuery = z.infer<typeof RequestQuerySchema>;

export const OfferOptionsSchema = z
  .object({
    date: z.string(),
  })
  .catchall(z.any());

export type OfferOptions = z.infer<typeof OfferOptionsSchema>;

export const contractConfig: ContractConfig = {
  name: 'WtMarket',
  version: '1',
  chainId: '1',
  address: '0x0',
};

export const serverAddress =
  '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf';
