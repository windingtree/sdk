import { afterAll, beforeAll, describe, expect, it } from './setup.js';
import { NodeExample } from './examples/node.js';
import { ClientExample } from './examples/client.js';
import { ServerExample } from './examples/server.js';

let server: ServerExample;
let node: NodeExample;
let client: ClientExample;

const topic = 'hello';
const message = 'Test request';

describe('e2e', () => {
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
    expect(offer.request.topic).to.be.eq(topic);
  });

  afterAll(async () => {
    await node.stop();
    await client.stop();
    await server.stop();
  });
});
