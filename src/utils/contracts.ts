import {
  Address,
  Hash,
  PublicClient,
  WalletClient,
  GetFunctionArgs,
  InferFunctionName,
  TransactionReceipt,
  getAddress,
  BaseError,
  ContractFunctionRevertedError,
  SimulateContractParameters,
  WriteContractParameters,
  ReadContractReturnType,
  ReadContractParameters,
} from 'viem';
import { Abi } from 'abitype';
import { erc20_18ABI } from '@windingtree/contracts';
import { PaymentOption } from '../shared/types.js';

/**
 * Smart contract configuration type
 */
export interface ContractConfig {
  /** Smart contract name */
  name: string;
  /** Internal smart contract version */
  version: string;
  /** Smart contract address */
  address: Address;
}

/**
 * The protocol smart contract set configuration
 */
export interface ProtocolContracts {
  /** The protocol configuration smart contract */
  config: ContractConfig;
  /** The protocol entities registry smart contract */
  entities: ContractConfig;
  /** The protocol market smart contract */
  market: ContractConfig;
  /** The protocol utility token */
  token: ContractConfig;
}

/**
 * The protocol chain configuration
 */
export interface ProtocolChain {
  /** Chain Id */
  chainId: number;
  /** Contracts configuration */
  contracts: ProtocolContracts;
}

/**
 * Type of callback that will be called when a transaction sent
 */
export type TxCallback = (txHash: string) => void;

/**
 * Returns payment option by Id
 *
 * @param {PaymentOption[]} options Payment options
 * @param {string} paymentId Payment option Id
 * @returns {PaymentOption} Payment option
 */
export const getPaymentOption = (options: PaymentOption[], paymentId: Hash): PaymentOption => {
  const option = options.find((o) => o.id === paymentId);

  if (!option) {
    throw new Error(`Payment option ${paymentId} not found`);
  }

  return option;
};

/**
 * Returns the balance of the provider signer
 *
 * @param {PublicClient} publicClient Ethereum public client
 * @param {WalletClient} walletClient Ethereum wallet client
 * @returns {bigint}
 */
export const getAccountBalance = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
): Promise<bigint> => {
  const [address] = await walletClient.getAddresses();
  return await publicClient.getBalance({ address });
};

/**
 * Returns the address of the provider signer
 *
 * @param {WalletClient} walletClient Ethereum wallet client
 * @returns {Address}
 */
export const getSignerAddress = async (walletClient: WalletClient): Promise<Address> => {
  const [address] = await walletClient.getAddresses();
  return getAddress(address);
};

/**
 * Contract read helper
 *
 * @template TAbi
 * @template TFunctionName
 * @param {Address} address Contract address
 * @param {TAbi} abi Contract ABI
 * @param {TFunctionName} functionName Function name to call
 * @param {GetFunctionArgs<TAbi, TFunctionName>} args Functions arguments
 * @param {PublicClient} publicClient Ethereum public client
 * @returns {Promise<ReadContractReturnType<TAbi, TFunctionName>>}
 */
export const readHelper = async <
  TAbi extends Abi | readonly [] = Abi,
  TFunctionName extends string = string,
>(
  address: Address,
  abi: TAbi,
  functionName: InferFunctionName<TAbi, TFunctionName>,
  args: GetFunctionArgs<TAbi, TFunctionName>['args'],
  publicClient: PublicClient,
): Promise<ReadContractReturnType<TAbi, TFunctionName>> =>
  publicClient.readContract({
    address,
    abi,
    functionName,
    args,
  } as unknown as ReadContractParameters<TAbi, TFunctionName>);

/**
 * Universal send helper
 *
 * @template TAbi
 * @template TFunctionName
 * @param {Address} address Contract address
 * @param {TAbi} abi Contract ABI
 * @param {TFunctionName} functionName Function name to call
 * @param {GetFunctionArgs<TAbi, TFunctionName>} args Functions arguments
 * @param {PublicClient} publicClient Ethereum public client
 * @param {WalletClient} walletClient Ethereum wallet client
 * @param {TxCallback} [txCallback] Optional transaction hash callback
 * @returns {Promise<TransactionReceipt>}
 */
export const sendHelper = async <
  TAbi extends Abi | readonly [] = Abi,
  TFunctionName extends string = string,
>(
  address: Address,
  abi: TAbi,
  functionName: InferFunctionName<TAbi, TFunctionName>,
  args: GetFunctionArgs<TAbi, TFunctionName>['args'],
  publicClient: PublicClient,
  walletClient: WalletClient,
  txCallback?: TxCallback,
): Promise<TransactionReceipt> => {
  try {
    const [account] = await walletClient.getAddresses();

    const { request } = await publicClient.simulateContract({
      address,
      abi,
      functionName,
      args,
      account,
    } as unknown as SimulateContractParameters<TAbi, TFunctionName>);

    const hash = await walletClient.writeContract(
      request as unknown as WriteContractParameters<TAbi, TFunctionName, undefined>,
    );

    if (txCallback) {
      txCallback(hash);
    }

    return await publicClient.waitForTransactionReceipt({ hash });
  } catch (error) {
    if (error instanceof BaseError && error.cause instanceof ContractFunctionRevertedError) {
      const cause: ContractFunctionRevertedError = error.cause;
      throw new Error(cause.data?.errorName ?? 'Unknown contract function revert error');
    }

    throw error;
  }
};

/**
 * Approves spending ERC20 asset
 */
export const approveAsset = async (
  asset: Address,
  spender: Address,
  amount: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
  txCallback?: TxCallback,
): Promise<void> => {
  const [owner] = await walletClient.getAddresses();
  const allowance = await readHelper(
    asset,
    erc20_18ABI,
    'allowance',
    [owner, spender],
    publicClient,
  );

  if (allowance < amount) {
    await sendHelper<typeof erc20_18ABI>(
      asset,
      erc20_18ABI,
      'approve',
      [spender, amount - allowance],
      publicClient,
      walletClient,
      txCallback,
    );
  }
};
