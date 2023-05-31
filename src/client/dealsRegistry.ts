import { Address, Hash, HDAccount, getAddress, PublicClient, WalletClient } from 'viem';
import { Abi } from 'abitype';
import { marketABI } from '@windingtree/contracts';
import { Client, createCheckInOutSignature } from '../index.js';
import { GenericOfferOptions, GenericQuery, OfferData } from '../shared/types.js';
import { Storage } from '../storage/index.js';
import {
  getPaymentOption,
  approveAsset,
  TxCallback,
  ContractConfig,
  getSignerAddress,
  sendHelper,
  readHelper,
} from '../utils/contracts.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DealsRegistry');

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

/**
 * Deals registry record
 */
export interface DealRecord<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Network chain Id */
  chainId: number;
  /** Deal creation time in seconds */
  created: bigint;
  /** Offer */
  offer: OfferData<CustomRequestQuery, CustomOfferOptions>;
  /** Deal retailer Id */
  retailerId: string;
  /** Deal owner */
  buyer: Address;
  /** Deal price */
  price: bigint;
  /** Deal asset */
  asset: Address;
  /** Current deal status */
  status: DealStatus;
}

export interface DealCurrentStatus {
  offerId: Hash;
  status: DealStatus;
}

export interface DealsRegistryOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Instance of Client */
  client: Client<CustomRequestQuery, CustomOfferOptions>;
  /** Instance of storage */
  storage: Storage;
  /** Registry storage prefix */
  prefix: string;
}

export interface ContractClientConfig {
  address: Address;
  abi: Abi;
}

/**
 * Creates an instance of DealsRegistry.
 *
 * @param {DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>} options
 * @memberof RequestsRegistry
 */
export class DealsRegistry<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  private client: Client<CustomRequestQuery, CustomOfferOptions>;
  /** Mapping of an offer id => Deal */
  private deals: Map<string, DealRecord<CustomRequestQuery, CustomOfferOptions>>; // id => Deal
  private storage?: Storage;
  private storageKey: string;

  /**
   * Creates an instance of DealsRegistry.
   *
   * @param {DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>} options
   * @memberof DealsRegistry
   */
  constructor(options: DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>) {
    const { client, storage, prefix } = options;

    this.client = client;
    this.deals = new Map<string, DealRecord<CustomRequestQuery, CustomOfferOptions>>();
    this.storageKey = `${prefix}_deals_records`;
    this.storage = storage;
    this._storageUp().catch(logger.error);
  }

  /**
   * Restores class state from the storage
   *
   * @private
   * @returns {Promise<void>}
   * @memberof RequestsRegistry
   */
  private async _storageUp(): Promise<void> {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    const rawRecords = await this.storage.get<DealRecord<CustomRequestQuery, CustomOfferOptions>[]>(
      this.storageKey,
    );

    if (rawRecords) {
      for (const dealRecord of rawRecords) {
        try {
          this.deals.set(dealRecord.offer.payload.id, dealRecord);
        } catch (error) {
          logger.error(error);
        }
      }
    }
  }

  /**
   * Stores class state to the storage
   *
   * @private
   * @memberof RequestsRegistry
   */
  private _storageDown(): void {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    this.storage.set(this.storageKey, Array.from(this.deals.values())).catch(logger.error);
  }

  /**
   * Returns Market contract configuration
   *
   * @private
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @returns {ContractConfig}
   * @memberof DealsRegistry
   */
  private _getMarketConfig(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
  ): ContractConfig {
    const domain = this.client.chain.contracts.market;

    if (!domain) {
      throw new Error(`Chain ${offer.payload.chainId} not found`);
    }

    return domain;
  }

  /**
   * Builds and saves the deal record based on the offer
   *
   * @private
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {PublicClient} publicClient Ethereum public client
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  private async _buildDealRecord(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    publicClient: PublicClient,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const market = this._getMarketConfig(offer);
    const marketContract = {
      address: market.address,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      abi: marketABI,
    };

    // Fetching deal information from smart contract
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [created, _, retailerId, buyer, price, asset, status] = await publicClient.readContract({
      ...marketContract,
      functionName: 'deals',
      args: [offer.payload.id],
    });

    // Preparing deal record for registry
    const dealRecord: DealRecord<CustomRequestQuery, CustomOfferOptions> = {
      chainId: await publicClient.getChainId(),
      created: created,
      offer,
      retailerId: retailerId,
      buyer: buyer,
      price: price,
      asset: asset,
      status: Number(status),
    };

    // Add the record to registry
    this.deals.set(offer.payload.id, dealRecord);
    this._storageDown();

    return dealRecord;
  }

  /**
   * Creates a deal from offer
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
   * @param {Hash} paymentId Chosen payment Id (from offer.payment)
   * @param {Hash} retailerId Retailer Id
   * @param {PublicClient} publicClient Ethereum public client
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>} Deal record
   * @memberof DealsRegistry
   */
  async create(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    paymentId: Hash,
    retailerId: Hash,
    publicClient: PublicClient,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const market = this._getMarketConfig(offer);

    // Extracting the proper payment method by Id
    // Will throw a error if invalid payment Id provided
    const paymentOption = getPaymentOption(offer.payment, paymentId);

    // Asset must be allowed to Market in the proper amount
    // This function will check allowance and send `approve` transaction if required
    await approveAsset(
      paymentOption.asset,
      market.address,
      BigInt(paymentOption.price),
      publicClient,
      walletClient,
      txCallback,
    );

    await sendHelper(
      market.address,
      marketABI,
      'deal',
      [offer.payload, offer.payment, paymentId, retailerId, [offer.signature]],
      publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(offer, publicClient);
  }

  /**
   * Returns an up-to-date deal record
   *
   * @param {Hash} offerId Offer Id
   * @param {PublicClient} publicClient Ethereum public client
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  async get(
    offerId: Hash,
    publicClient: PublicClient,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = this.deals.get(offerId);

    if (!dealRecord) {
      throw new Error(`Deal ${offerId} not found`);
    }

    if (dealRecord.status === DealStatus.CheckedOut) {
      return dealRecord;
    }

    return await this._buildDealRecord(dealRecord.offer, publicClient);
  }

  /**
   * Returns all an up-to-date deal records
   *
   * @param {PublicClient} publicClient Ethereum public client
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]>}
   * @memberof DealsRegistry
   */
  async getAll(
    publicClient: PublicClient,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]> {
    const records: DealRecord<CustomRequestQuery, CustomOfferOptions>[] = [];

    for (const record of this.deals.values()) {
      try {
        records.push(await this.get(record.offer.payload.id, publicClient));
      } catch (error) {
        logger.error(error);
      }
    }

    return records;
  }

  /**
   * Cancels the deal
   *
   * @param {Hash} offerId Offer Id
   * @param {PublicClient} publicClient Ethereum public client
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async cancel(
    offerId: Hash,
    publicClient: PublicClient,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = await this.get(offerId, publicClient);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(`Cancellation not allowed in the status ${DealStatus[dealRecord.status]}`);
    }

    const market = this._getMarketConfig(dealRecord.offer);

    await sendHelper(
      market.address,
      marketABI,
      'cancel',
      [dealRecord.offer.payload.id, dealRecord.offer.cancel],
      publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer, publicClient);
  }

  /**
   * Transfers the deal to another address
   *
   * @param {Hash} offerId Offer Id
   * @param {string} to New owner address
   * @param {PublicClient} publicClient Ethereum public client
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async transfer(
    offerId: Hash,
    to: Address,
    publicClient: PublicClient,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let dealRecord = await this.get(offerId, publicClient);

    const signerAddress = await getSignerAddress(walletClient);

    if (signerAddress !== getAddress(dealRecord.buyer)) {
      throw new Error(`You are not the deal owner`);
    }

    if (!dealRecord.offer.payload.transferable) {
      throw new Error(`Transfer of the deal ${offerId} is not allowed`);
    }

    // Updating the record
    dealRecord = await this._buildDealRecord(dealRecord.offer, publicClient);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(`Transfer not allowed in the status ${DealStatus[dealRecord.status]}`);
    }

    const market = this._getMarketConfig(dealRecord.offer);

    // Getting of tokenId of the deal
    const tokenId = await readHelper(
      market.address,
      marketABI,
      'offerTokens',
      [dealRecord.offer.payload.id],
      publicClient,
    );

    await sendHelper(
      market.address,
      marketABI,
      'safeTransferFrom',
      [signerAddress, to, tokenId],
      publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer, publicClient);
  }

  /**
   * Makes the deal check-in
   *
   * @param {Hash} offerId
   * @param {Hash} supplierSignature
   * @param {PublicClient} publicClient Ethereum public client
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async checkIn(
    offerId: Hash,
    supplierSignature: Hash,
    publicClient: PublicClient,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = await this.get(offerId, publicClient);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(`CheckIn not allowed in the status ${DealStatus[dealRecord.status]}`);
    }

    const market = this._getMarketConfig(dealRecord.offer);

    if (!walletClient.account) {
      throw new Error('Invalid wallet configuration');
    }

    const buyerSignature = await createCheckInOutSignature({
      offerId: dealRecord.offer.payload.id,
      domain: {
        chainId: this.client.chain.chainId,
        name: this.client.chain.contracts.market.name,
        version: this.client.chain.contracts.market.version,
        verifyingContract: this.client.chain.contracts.market.address,
      },
      account: walletClient.account as unknown as HDAccount,
    });

    await sendHelper(
      market.address,
      marketABI,
      'checkIn',
      [dealRecord.offer.payload.id, [buyerSignature, supplierSignature]],
      publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer, publicClient);
  }
}
