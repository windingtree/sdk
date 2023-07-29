import { RequestQuery, serverAddress } from 'wtmp-examples-shared-files';
import { EventHandler } from '@libp2p/interfaces/events';
import { buildRequest } from '@windingtree/sdk-messages';
import { memoryStorage } from '@windingtree/sdk-storage';
import {
  GenericOfferOptions,
  GenericQuery,
  OfferData,
  RequestData,
} from '@windingtree/sdk-types';
import {
  Client,
  ClientRequestRecord,
  ClientRequestsManager,
} from '@windingtree/sdk-client';
import { createLogger } from '@windingtree/sdk-logger';

const defaultExpire = '30s';

const logger = createLogger('Server');

export class ClientExample {
  private requests: Set<RequestData<RequestQuery>> = new Set<
    RequestData<RequestQuery>
  >();
  private client: Client | undefined;
  private requestsManager: ClientRequestsManager | undefined;

  private offers: Set<OfferData> = new Set();

  public start = async () => {
    this.client = new Client({
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
    logger.trace('🚀 Client started at:', new Date().toISOString());
  };

  onClientStop = () => {
    logger.trace('👋 Client stopped at:', new Date().toISOString());
  };

  onClientConnected = () => {
    logger.trace('🔗 Client connected to server at:', new Date().toISOString());
    //requests emit localstorage
    this.requests.forEach((request) => {
      this.client?.subscribe(request.id);
      this.requestsManager?.add(request);
    });
  };

  onClientDisconnected = () => {
    logger.trace(
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

    this.requests.add(request);
    this.client.publish(request);
  };

  get connected() {
    return !!this.client?.connected;
  }

  get getOffers() {
    return this.offers;
  }

  get getRequests() {
    return this.requests;
  }

  setRequests = (requests: Set<RequestData<RequestQuery>>) => {
    this.requests = requests;
  };

  stop = async () => {
    this.client?.removeEventListener('start', this.onClientStart);
    this.client?.removeEventListener('stop', this.onClientStop);
    this.client?.removeEventListener('connected', this.onClientConnected);
    this.client?.removeEventListener('disconnected', this.onClientDisconnected);
    this.client?.removeEventListener('publish', this.onRequestPublish);
    this.client?.removeEventListener('offer', this.onOffer);

    this.requestsManager?.removeEventListener(
      'subscribe',
      this.onRequestSubscribe,
    );
    this.requestsManager?.removeEventListener(
      'unsubscribe',
      this.onRequestUnsubscribe,
    );

    await this.client?.stop();
  };
}
