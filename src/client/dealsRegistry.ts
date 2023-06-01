import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { Address, Hash, HDAccount, getAddress, WalletClient } from 'viem';
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
 * Deals manager events interface
 */
export interface DealEvents<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /**
   * @example
   *
   * ```js
   * registry.addEventListener('status', () => {
   *    // ... deal status changed
   * })
   * ```
   */
  status: CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('changed', () => {
   *    // ... deals store changed
   * })
   * ```
   */
  changed: CustomEvent<void>;
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
> extends EventEmitter<DealEvents<CustomRequestQuery, CustomOfferOptions>> {
  private client: Client<CustomRequestQuery, CustomOfferOptions>;
  /** Mapping of an offer id => Deal */
  private deals: Map<string, DealRecord<CustomRequestQuery, CustomOfferOptions>>; // id => Deal
  private storage?: Storage;
  private storageKey: string;
  private checkInterval?: NodeJS.Timer;
  private ongoingCheck = false;

  /**
   * Creates an instance of DealsRegistry.
   *
   * @param {DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>} options
   * @memberof DealsRegistry
   */
  constructor(options: DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    const { client, storage, prefix } = options;

    this.client = client;
    this.deals = new Map<string, DealRecord<CustomRequestQuery, CustomOfferOptions>>();
    this.storageKey = `${prefix}_deals_records`;
    this.storage = storage;
    this._storageUp()
      .then(() => {
        this.checkInterval = setInterval(() => {
          this._checkDealsStates().catch(logger.error);
        }, 2000);
      })
      .catch(logger.error);
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
   * Checks and updates state of all deals records
   *
   * @private
   * @memberof DealsRegistry
   */
  private async _checkDealsStates(): Promise<void> {
    if (this.ongoingCheck) {
      return;
    }

    this.ongoingCheck = true;
    const records = await this.getAll();
    const recordsToCheck = records.filter(({ status }) =>
      [DealStatus.Created, DealStatus.Claimed, DealStatus.CheckedIn, DealStatus.Disputed].includes(
        status,
      ),
    );
    const checkedRecords = await Promise.all(
      recordsToCheck.map((r) => this._buildDealRecord(r.offer)),
    );
    let shouldEmitChanged = false;
    checkedRecords.forEach((r, index) => {
      if (r.status !== recordsToCheck[index].status) {
        shouldEmitChanged = true;
        this.dispatchEvent(
          new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>('status', {
            detail: r,
          }),
        );
      }
    });
    if (shouldEmitChanged) {
      this.dispatchEvent(new CustomEvent<void>('changed'));
    }
    this.ongoingCheck = false;
  }

  /**
   * Builds and saves the deal record based on the offer
   *
   * @private
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  private async _buildDealRecord(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const market = this._getMarketConfig(offer);
    const marketContract = {
      address: market.address,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      abi: marketABI,
    };

    // Fetching deal information from smart contract
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [created, _, retailerId, buyer, price, asset, status] =
      await this.client.publicClient.readContract({
        ...marketContract,
        functionName: 'deals',
        args: [offer.payload.id],
      });

    // Preparing deal record for registry
    const dealRecord: DealRecord<CustomRequestQuery, CustomOfferOptions> = {
      chainId: await this.client.publicClient.getChainId(),
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
   * Graceful deals registry stop
   */
  stop() {
    clearInterval(this.checkInterval);
  }

  /**
   * Creates a deal from offer
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
   * @param {Hash} paymentId Chosen payment Id (from offer.payment)
   * @param {Hash} retailerId Retailer Id
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>} Deal record
   * @memberof DealsRegistry
   */
  async create(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    paymentId: Hash,
    retailerId: Hash,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let deal: DealRecord<CustomRequestQuery, CustomOfferOptions> | undefined;

    try {
      deal = await this.get(offer.payload.id);
    } catch (error) {
      logger.error(error);
    }

    if (deal) {
      throw new Error(`Deal ${offer.payload.id} already created!`);
    }

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
      this.client.publicClient,
      walletClient,
      txCallback,
    );

    await sendHelper(
      market.address,
      marketABI,
      'deal',
      [offer.payload, offer.payment, paymentId, retailerId, [offer.signature]],
      this.client.publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(offer);
  }

  /**
   * Returns an up-to-date deal record
   *
   * @param {Hash} offerId Offer Id
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  async get(offerId: Hash): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = this.deals.get(offerId);

    if (!dealRecord) {
      throw new Error(`Deal ${offerId} not found`);
    }

    if (dealRecord.status === DealStatus.CheckedOut) {
      return dealRecord;
    }

    return await this._buildDealRecord(dealRecord.offer);
  }

  /**
   * Returns all an up-to-date deal records
   *
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]>}
   * @memberof DealsRegistry
   */
  async getAll(): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]> {
    const records: DealRecord<CustomRequestQuery, CustomOfferOptions>[] = [];

    for (const record of this.deals.values()) {
      try {
        records.push(await this.get(record.offer.payload.id));
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
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async cancel(
    offerId: Hash,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = await this.get(offerId);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(`Cancellation not allowed in the status ${DealStatus[dealRecord.status]}`);
    }

    const market = this._getMarketConfig(dealRecord.offer);

    await sendHelper(
      market.address,
      marketABI,
      'cancel',
      [dealRecord.offer.payload.id, dealRecord.offer.cancel],
      this.client.publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer);
  }

  /**
   * Transfers the deal to another address
   *
   * @param {Hash} offerId Offer Id
   * @param {string} to New owner address
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async transfer(
    offerId: Hash,
    to: Address,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let dealRecord = await this.get(offerId);

    const signerAddress = await getSignerAddress(walletClient);

    if (signerAddress !== getAddress(dealRecord.buyer)) {
      throw new Error(`You are not the deal owner`);
    }

    if (!dealRecord.offer.payload.transferable) {
      throw new Error(`Transfer of the deal ${offerId} is not allowed`);
    }

    // Updating the record
    dealRecord = await this._buildDealRecord(dealRecord.offer);

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
      this.client.publicClient,
    );

    await sendHelper(
      market.address,
      marketABI,
      'safeTransferFrom',
      [signerAddress, to, tokenId],
      this.client.publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer);
  }

  /**
   * Makes the deal check-in
   *
   * @param {Hash} offerId
   * @param {Hash} supplierSignature
   * @param {WalletClient} walletClient Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async checkIn(
    offerId: Hash,
    supplierSignature: Hash,
    walletClient: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = await this.get(offerId);

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
      this.client.publicClient,
      walletClient,
      txCallback,
    );

    return await this._buildDealRecord(dealRecord.offer);
  }
}
