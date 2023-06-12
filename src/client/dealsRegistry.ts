import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import {
  Address,
  Hash,
  HDAccount,
  WalletClient,
  PublicClient,
  zeroAddress,
} from 'viem';
import { Client, createCheckInOutSignature } from '../index.js';
import {
  GenericOfferOptions,
  GenericQuery,
  OfferData,
} from '../shared/types.js';
import {
  DealStatus,
  ProtocolContracts,
  TxCallback,
} from '../shared/contracts.js';
import { Storage } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DealsRegistry');

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
  /** Public client */
  publicClient: PublicClient;
  /** Wallet client */
  walletClient?: WalletClient;
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
  private contractsManager: ProtocolContracts<
    CustomRequestQuery,
    CustomOfferOptions
  >;
  /** Mapping of an offer id => Deal */
  private deals: Map<
    string,
    DealRecord<CustomRequestQuery, CustomOfferOptions>
  >; // id => Deal
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
  constructor(
    options: DealsRegistryOptions<CustomRequestQuery, CustomOfferOptions>,
  ) {
    super();

    const { client, storage, prefix, publicClient, walletClient } = options;

    this.client = client;
    this.contractsManager = new ProtocolContracts<
      CustomRequestQuery,
      CustomOfferOptions
    >({
      contracts: this.client.contracts,
      publicClient,
      walletClient,
    });
    this.deals = new Map<
      string,
      DealRecord<CustomRequestQuery, CustomOfferOptions>
    >();
    this.storageKey = `${prefix}_deals_records`;
    this.storage = storage;
    this._storageUp()
      .then(() => {
        this.checkInterval = setInterval(() => {
          this._checkDealsStates().catch(logger.error);
        }, 5000);
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

    const rawRecords = await this.storage.get<
      DealRecord<CustomRequestQuery, CustomOfferOptions>[]
    >(this.storageKey);

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

    this.storage
      .set(this.storageKey, Array.from(this.deals.values()))
      .catch(logger.error);
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
      [
        DealStatus.Created,
        DealStatus.Claimed,
        DealStatus.CheckedIn,
        DealStatus.Disputed,
      ].includes(status),
    );
    const checkedRecords = await Promise.all(
      recordsToCheck.map((r) => this._buildDealRecord(r.offer)),
    );
    let shouldEmitChanged = false;
    checkedRecords.forEach((r, index) => {
      if (r.status !== recordsToCheck[index].status) {
        shouldEmitChanged = true;
        this.dispatchEvent(
          new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>(
            'status',
            {
              detail: r,
            },
          ),
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
    // Fetching deal information from smart contract
    const [created, , retailerId, buyer, price, asset, status] =
      await this.contractsManager.getDeal(offer);

    if (buyer === zeroAddress) {
      throw new Error(`Offer ${offer.payload.id} not found`);
    }

    // Preparing deal record for registry
    const dealRecord: DealRecord<CustomRequestQuery, CustomOfferOptions> = {
      chainId: this.client.chain.id,
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
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>} Deal record
   * @memberof DealsRegistry
   */
  async create(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    paymentId: Hash,
    retailerId: Hash,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let deal: DealRecord<CustomRequestQuery, CustomOfferOptions> | undefined;

    try {
      deal = await this.get(offer);
    } catch (error) {
      logger.error(error);
    }

    if (deal) {
      throw new Error(`Deal ${offer.payload.id} already created!`);
    }

    await this.contractsManager.createDeal(
      offer,
      paymentId,
      retailerId,
      walletClient,
      txCallback,
    );

    const record = await this._buildDealRecord(offer);

    this.dispatchEvent(new CustomEvent<void>('changed'));

    return record;
  }

  /**
   * Returns an up-to-date deal record
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  async get(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = this.deals.get(offer.payload.id);

    if (dealRecord && dealRecord.status === DealStatus.CheckedOut) {
      return dealRecord;
    }

    return await this._buildDealRecord(offer);
  }

  /**
   * Returns all an up-to-date deal records
   *
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]>}
   * @memberof DealsRegistry
   */
  async getAll(): Promise<
    DealRecord<CustomRequestQuery, CustomOfferOptions>[]
  > {
    const records: DealRecord<CustomRequestQuery, CustomOfferOptions>[] = [];

    for (const record of this.deals.values()) {
      try {
        records.push(await this.get(record.offer));
      } catch (error) {
        logger.error(error);
      }
    }

    return records;
  }

  /**
   * Cancels the deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async cancel(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    const dealRecord = await this.get(offer);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(
        `Cancellation not allowed in the status ${
          DealStatus[dealRecord.status]
        }`,
      );
    }

    await this.contractsManager.cancelDeal(offer, walletClient, txCallback);

    const record = await this._buildDealRecord(dealRecord.offer);

    this.dispatchEvent(
      new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>(
        'status',
        {
          detail: record,
        },
      ),
    );
    this.dispatchEvent(new CustomEvent<void>('changed'));

    return record;
  }

  /**
   * Transfers the deal to another address
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {string} to New owner address
   * @param {WalletClient} [walletClient] Wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async transfer(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    to: Address,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let dealRecord = await this.get(offer);

    await this.contractsManager.transferDeal(
      dealRecord.offer,
      to,
      walletClient,
      txCallback,
    );

    dealRecord = await this._buildDealRecord(dealRecord.offer);

    this.dispatchEvent(
      new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>(
        'status',
        {
          detail: dealRecord,
        },
      ),
    );
    this.dispatchEvent(new CustomEvent<void>('changed'));

    return dealRecord;
  }

  /**
   * Makes the deal check-in
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash} supplierSignature
   * @param {WalletClient} walletClient
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  async checkIn(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    supplierSignature: Hash,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    let dealRecord = await this.get(offer);

    if (![DealStatus.Created, DealStatus.Claimed].includes(dealRecord.status)) {
      throw new Error(
        `CheckIn not allowed in the status ${DealStatus[dealRecord.status]}`,
      );
    }

    if (!walletClient || !walletClient.account) {
      throw new Error('Invalid walletClient configuration');
    }

    const buyerSignature = await createCheckInOutSignature({
      offerId: dealRecord.offer.payload.id,
      domain: {
        chainId: this.client.chain.id,
        name: this.client.contracts.market.name,
        version: this.client.contracts.market.version,
        verifyingContract: this.client.contracts.market.address,
      },
      account: walletClient.account as unknown as HDAccount,
    });

    await this.contractsManager.checkInDeal(
      dealRecord.offer,
      [buyerSignature, supplierSignature],
      walletClient,
      txCallback,
    );

    dealRecord = await this._buildDealRecord(dealRecord.offer);

    this.dispatchEvent(
      new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>(
        'status',
        {
          detail: dealRecord,
        },
      ),
    );
    this.dispatchEvent(new CustomEvent<void>('changed'));

    return dealRecord;
  }
}
