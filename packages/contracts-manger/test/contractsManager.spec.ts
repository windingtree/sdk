import { beforeAll, describe, expect, it } from '@windingtree/sdk-test-utils';
import { ProtocolContracts } from '../dist/index.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { contractsConfig } from 'wtmp-examples-shared-files';
import { generateMnemonic } from '@windingtree/sdk-utils';
import { GenericOfferOptions, GenericQuery } from '@windingtree/sdk-types';

const chain = process.env.LOCAL_NODE === 'true' ? hardhat : polygonZkEvmTestnet;

describe('ContractsManager.', () => {
  const signer = mnemonicToAccount(generateMnemonic());
  let contractsManager: ProtocolContracts<GenericQuery, GenericOfferOptions>;
  beforeAll(() => {
    contractsManager = new ProtocolContracts({
      contracts: contractsConfig,
      publicClient: createPublicClient({
        chain,
        transport: http(),
      }),
      walletClient: createWalletClient({
        chain,
        transport: http(),
        account: signer.address,
      }),
    });
  });

  it('should ', () => {
    expect(contractsManager.publicClient.chain).toEqual(chain);
  });
});
