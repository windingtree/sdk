import {
  Address,
  Hash,
  Abi,
  Account,
  InferFunctionName,
  GetFunctionArgs,
  SimulateContractParameters,
  ContractFunctionResult,
  TransactionReceipt,
  BaseError,
  ContractFunctionRevertedError,
  PublicClient,
  WalletClient,
  stringToHex,
  getAddress,
  zeroAddress,
  stringify,
} from 'viem';
import { marketABI, erc20_18ABI } from '@windingtree/contracts';
import { Contracts, GenericOfferOptions, GenericQuery, OfferData } from './types.js';
import { getPaymentOption } from '../utils/offer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ProtocolContracts');

/**
 * Type of callback that will be called when a transaction sent
 */
export type TxCallback = (txHash: string, txSubject?: string) => void;

/**
 * Deal status
 */
export enum DealStatus {
  Created, // Just created
  Claimed, // Claimed by the supplier
  Rejected, // Rejected by the supplier
  Refunded, // Refunded by the supplier
  Cancelled, // Cancelled by the buyer
  CheckedIn, // Checked In
  CheckedOut, // Checked Out
  Disputed, // Dispute started
}

export interface ProtocolContractsOptions {
  contracts: Contracts;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

/**
 * Common API of the protocol smart contracts set
 *
 * @export
 * @class ProtocolContracts
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 */
export class ProtocolContracts<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Protocol smart contracts */
  contracts: Contracts;
  /** Public client */
  publicClient: PublicClient;
  /** Wallet client */
  walletClient?: WalletClient;

  /**
   * Creates an instance of ProtocolContracts
   *
   * @param {ProtocolContractsOptions} options
   * @memberof ProtocolContracts
   */
  constructor(options: ProtocolContractsOptions) {
    const { contracts, publicClient, walletClient } = options;

    // @todo Validate ProtocolContractsOptions

    this.contracts = contracts;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  /**
   * Universal send helper
   *
   * @private
   * @template TAbi
   * @template TFunctionName
   * @param {Address} address Contract instance address
   * @param {TAbi} abi Contract API
   * @param {InferFunctionName<TAbi, TFunctionName>} functionName Function name to call
   * @param {GetFunctionArgs<TAbi, TFunctionName>['args']} args Functions args
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  private async _sendHelper<TAbi extends Abi = Abi, TFunctionName extends string = string>(
    address: Address,
    abi: TAbi,
    functionName: InferFunctionName<TAbi, TFunctionName>,
    args: GetFunctionArgs<TAbi, TFunctionName>['args'],
    walletClient?: WalletClient,
    txCallback?: TxCallback,
    txSubject?: string,
  ): Promise<TransactionReceipt> {
    try {
      walletClient = walletClient ?? this.walletClient;

      if (!walletClient) {
        throw new Error('Invalid walletClient configuration');
      }

      let account = walletClient.account;

      if (!account || account?.type !== 'local') {
        const [accountAddress] = await walletClient.getAddresses();
        account = accountAddress as unknown as Account;
      }

      const requestOptions = {
        address,
        abi,
        functionName,
        args,
        account,
      } as unknown as SimulateContractParameters;

      logger.trace('Request options:', stringify(requestOptions));

      const { request } = await this.publicClient.simulateContract(requestOptions);

      const hash = await walletClient.writeContract(request);

      logger.trace(`Tx: ${hash}, subject: "${txSubject ?? ''}"`);

      if (txCallback) {
        txCallback(hash, txSubject);
      }

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      logger.trace('Tx receipt:', receipt);

      return receipt;
    } catch (error) {
      logger.error(error);

      if (error instanceof BaseError && error.cause instanceof ContractFunctionRevertedError) {
        const cause: ContractFunctionRevertedError = error.cause;
        throw new Error(cause.data?.errorName ?? 'Unknown contract function revert error');
      }

      throw error;
    }
  }

  /**
   * Fetches a deal information from the smart contract
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @returns {Promise<ContractFunctionResult<typeof marketABI, 'deals'>>}
   * @memberof ProtocolContracts
   */
  async getDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
  ): Promise<ContractFunctionResult<typeof marketABI, 'deals'>> {
    return await this.publicClient.readContract({
      address: this.contracts['market'].address,
      abi: marketABI,
      functionName: 'deals',
      args: [offer.payload.id],
    });
  }

  /**
   * Creates new deal on offer
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash} paymentId Payment Id
   * @param {Hash} retailerId Retailer Id
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async createDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    paymentId: Hash,
    retailerId: Hash,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    const [, , , buyer] = await this.getDeal(offer);

    if (buyer !== zeroAddress) {
      throw new Error(`Deal ${offer.payload.id} already created!`);
    }

    // Extracting the proper payment method by Id
    // Will throw a error if invalid payment Id provided
    const paymentOption = getPaymentOption(offer.payment, paymentId);

    walletClient = walletClient ?? this.walletClient;

    if (!walletClient) {
      throw new Error('Invalid walletClient configuration');
    }

    // Asset must be allowed to Market in the proper amount
    // This function will check allowance and send `approve` transaction if required
    const [owner] = await walletClient.getAddresses();

    const allowance = await this.publicClient.readContract({
      address: paymentOption.asset,
      abi: erc20_18ABI,
      functionName: 'allowance',
      args: [owner, this.contracts['market'].address],
    });

    const amount = BigInt(paymentOption.price);

    if (allowance < amount) {
      await this._sendHelper(
        paymentOption.asset,
        erc20_18ABI,
        'approve',
        [this.contracts['market'].address, amount - allowance],
        walletClient,
        txCallback,
        'Payment asset approval',
      );

      // TODO: Implement `permit`
    }

    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'deal',
      [offer.payload, offer.payment, paymentId, retailerId, [offer.signature]],
      walletClient,
      txCallback,
      'Deal creation',
    );
  }

  /**
   * Cancels a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async cancelDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'cancel',
      [offer.payload.id, offer.cancel],
      walletClient,
      txCallback,
      'Deal cancellation',
    );
  }

  /**
   * Transfers a deal to another address
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {string} to New owner address
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async transferDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    to: Address,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    const [, , , buyer, , , status] = await this.getDeal(offer);

    if (!this.walletClient) {
      throw new Error(`Invalid walletClient configuration`);
    }

    const [signerAddress] = await this.walletClient.getAddresses();

    if (signerAddress !== getAddress(buyer)) {
      throw new Error(`You are not the deal owner`);
    }

    if (!offer.payload.transferable) {
      throw new Error(`Transfer of the deal ${offer.payload.id} is not allowed`);
    }

    if (![DealStatus.Created, DealStatus.Claimed].includes(status)) {
      throw new Error(`Transfer not allowed in the status ${DealStatus[status]}`);
    }

    const tokenId = await this.publicClient.readContract({
      address: this.contracts['market'].address,
      abi: marketABI,
      functionName: 'offerTokens',
      args: [offer.payload.id],
    });

    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'safeTransferFrom',
      [signerAddress, to, tokenId],
      walletClient,
      txCallback,
      'Deal transfer',
    );
  }

  /**
   * Rejects a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {string} reason Rejection reason
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async rejectDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    reason: string,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'reject',
      [offer.payload.id, stringToHex(reason, { size: 32 })],
      walletClient,
      txCallback,
      'Deal rejection',
    );
  }

  /**
   * Claims a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async claimDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'claim',
      [offer.payload.id],
      walletClient,
      txCallback,
      'Deal claiming',
    );
  }

  /**
   * Refunds a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async refundDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'refund',
      [offer.payload.id],
      walletClient,
      txCallback,
      'Deal refund',
    );
  }

  /**
   * Checks-in a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash[]} signs Signatures
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   *
   * Note:
   *
   * - if called by the supplier's signer:
   *   - a valid signature of suppliers's signer must be provided in signs[0]
   *   - if before sign-in time: a valid signature of the buyer must be provided in signs[1]
   * - if called buy buyer:
   *   - a valid signature of the buyer must be provided in signs[0]
   *   - a valid signature of suppliers's signer must be provided in signs[1]
   */
  async checkInDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    signs: Hash[],
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'checkIn',
      [offer.payload.id, signs],
      walletClient,
      txCallback,
      'Deal check in',
    );
  }

  /**
   * Checks-out a deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<TransactionReceipt>}
   * @memberof ProtocolContracts
   */
  async checkOutDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<TransactionReceipt> {
    return await this._sendHelper(
      this.contracts['market'].address,
      marketABI,
      'checkOut',
      [offer.payload.id],
      walletClient,
      txCallback,
      'Deal check out',
    );
  }
}
