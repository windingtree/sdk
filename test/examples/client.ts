import {
  buildRequest,
  Client,
  ClientRequestRecord,
  ClientRequestsManager,
  createClient,
} from '../../src/index.js';
import {
  OfferOptions,
  RequestQuery,
  serverAddress,
} from '../../examples/shared/index.js';
import { memoryStorage } from '../../src/storage/index.js';
import { EventHandler } from '@libp2p/interfaces/events';
import {
  GenericOfferOptions,
  GenericQuery,
  OfferData,
  RequestData,
} from '../../src/shared/types.js';

const defaultExpire = '30s';

export class ClientExample {
  private client: Client | undefined;
  private requestsManager: ClientRequestsManager | undefined;

  private offers: Set<OfferData> = new Set();

  public start = async () => {
    this.client = createClient<RequestQuery, OfferOptions>({
      serverAddress,
    });

    const init = memoryStorage.createInitializer();
    const storage = await init();
    this.requestsManager = new ClientRequestsManager({
      storage,
      prefix: 'test',
    });

    this.client.addEventListener('start', this.onClientStart);
    this.client.addEventListener('stop', this.onClientStop);
    this.client.addEventListener('connected', this.onClientConnected);
    this.client.addEventListener('disconnected', this.onClientDisconnected);
    this.client.addEventListener('publish', this.onRequestPublish);
    this.client.addEventListener('offer', this.onOffer);

    this.requestsManager.addEventListener('subscribe', this.onRequestSubscribe);
    this.requestsManager.addEventListener(
      'unsubscribe',
      this.onRequestUnsubscribe,
    );

    await this.client.start();
  };

  onClientStart = () => {
    console.log('🚀 Client started at:', new Date().toISOString());
  };

  onClientStop = () => {
    console.log('👋 Client stopped at:', new Date().toISOString());
  };

  onClientConnected = () => {
    console.log('🔗 Client connected to server at:', new Date().toISOString());
  };

  onClientDisconnected = () => {
    console.log(
      '🔌 Client disconnected from server at:',
      new Date().toISOString(),
    );
  };

  onRequestPublish: EventHandler<CustomEvent<RequestData<GenericQuery>>> = ({
    detail,
  }) => {
    this.requestsManager?.add(detail);
  };

  onOffer: EventHandler<
    CustomEvent<OfferData<GenericQuery, GenericOfferOptions>>
  > = ({ detail }) => {
    this.requestsManager?.addOffer(detail);
    this.offers.add(detail);
  };

  onRequestSubscribe: EventHandler<CustomEvent<ClientRequestRecord>> = ({
    detail,
  }) => {
    this.client?.subscribe(detail.data.id);
  };

  onRequestUnsubscribe: EventHandler<CustomEvent<ClientRequestRecord>> = ({
    detail,
  }) => {
    this.client?.unsubscribe(detail.data.id);
  };

  sendRequest = async (topic: string, message: string) => {
    if (!this.client) {
      throw new Error('The client is not initialized yet');
    }

    const request = await buildRequest<RequestQuery>({
      topic,
      expire: defaultExpire,
      nonce: BigInt(1),
      query: {
        greeting: message,
      },
    });

    this.client.publish(request);
  };

  get connected() {
    return !!this.client?.connected;
  }

  get getOffers() {
    return this.offers;
  }

  stop = async () => {
    await this.client?.stop();
  };
}
