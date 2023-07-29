import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExample } from './examples/node.js';
import { ClientExample } from './examples/client.js';
import { ServerExample } from './examples/server.js';
import { RequestData } from '@windingtree/sdk-types';
import { RequestQuery } from 'wtmp-examples-shared-files';

const topic = 'hello';
const message = 'Test request';

process.on('unhandledRejection', (error) => {
  console.log('Unhandled rejection detected:', error);
});

describe('e2e 1 scenario', () => {
  let server: ServerExample;
  let node: NodeExample;
  let client: ClientExample;

  beforeAll(async () => {
    server = new ServerExample();
    await server.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 500);
    });

    client = new ClientExample();
    await client.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 2000);
    });

    node = new NodeExample();
  });

  it('server status should be connected', () => {
    expect(server.connected).to.be.true;
  });

  it('client status should be connected', () => {
    expect(client.connected).to.be.true;
  });

  it('node status should be not connected', () => {
    expect(node.connected).to.be.false;
  });

  it('client should add request', async () => {
    await client.sendRequest(topic, message);
  });

  it("client shouldn't exist offer", () => {
    expect(client.getOffers.size).to.be.eq(0);
  });

  it('connect node', async () => {
    await node.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
  });

  it('node status should be connected', () => {
    expect(node.connected).to.be.true;
  });

  it('client should exist offer', () => {
    expect(client.getOffers.size).to.be.gt(0);
    const [offer] = client.getOffers;
    const [request] = client.getRequests;
    expect(offer.request.id).to.be.eq(request.id);
  });

  afterAll(async () => {
    await server.stop();
    await node.stop();
    await client.stop();
  });
});

describe('e2e 2 scenario', () => {
  let server: ServerExample;
  let node: NodeExample;
  let client: ClientExample;

  beforeAll(async () => {
    client = new ClientExample();
    node = new NodeExample();

    await client.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 2000);
    });

    server = new ServerExample();
  });

  it('client status should be connected', () => {
    expect(server.connected).to.be.false;
  });

  it('client status should be connected', () => {
    expect(client.connected).to.be.false;
  });

  it('connect server', async () => {
    await server.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
  });

  it('server status should be connected', () => {
    expect(server.connected).to.be.true;
  });

  it('client status should be connected', () => {
    expect(client.connected).to.be.true;
  });

  it('client should add request', async () => {
    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });

    await client.sendRequest(topic, message);
  });

  it("client shouldn't exist offer", () => {
    expect(client.getOffers.size).to.be.eq(0);
  });

  it('connect node', async () => {
    await node.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
  });

  it('node status should be connected', () => {
    expect(node.connected).to.be.true;
  });

  it('client should exist offer', () => {
    expect(client.getOffers.size).to.be.gt(0);
    const [offer] = client.getOffers;
    const [request] = client.getRequests;
    expect(offer.request.id).to.be.eq(request.id);
  });

  afterAll(async () => {
    await node.stop();
    await client.stop();
    await server.stop();
  });
});

describe('e2e 3 scenario', () => {
  let server: ServerExample;
  let node: NodeExample;
  let client: ClientExample;
  let client2: ClientExample;
  let requests: Set<RequestData<RequestQuery>>;

  beforeAll(async () => {
    server = new ServerExample();
    await server.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 500);
    });

    client = new ClientExample();
    await client.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 2000);
    });

    node = new NodeExample();
  });

  it('server status should be connected', () => {
    expect(server.connected).to.be.true;
  });

  it('client status should be connected', () => {
    expect(client.connected).to.be.true;
  });

  it('node status should be not connected', () => {
    expect(node.connected).to.be.false;
  });

  it('client should add request', async () => {
    await client.sendRequest(topic, message);
  });

  it("client shouldn't exist offer", () => {
    expect(client.getOffers.size).to.be.eq(0);
  });

  it('connect node', async () => {
    requests = client.getRequests;
    await client.stop();
    await node.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
  });

  it('node status should be connected', () => {
    expect(node.connected).to.be.true;
  });

  it('client status should be connected', () => {
    expect(client.connected).to.be.false;
  });

  it('client should be started', async () => {
    client2 = new ClientExample();
    client2.setRequests(requests);
    await client2.start();

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
  });

  it('client status should be connected', () => {
    expect(client2.connected).to.be.true;
  });

  it('client should exist offer', async () => {
    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 3000);
    });
    expect(client2.getOffers.size).to.be.gt(0);
    const [offer] = client2.getOffers;
    const [request] = client2.getRequests;
    expect(offer.request.id).to.be.eq(request.id);
  });

  afterAll(async () => {
    await server.stop();
    await node.stop();
    await client.stop();
  });
});
