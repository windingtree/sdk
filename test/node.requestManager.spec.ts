import './setup.js';
import { expect } from 'chai';
import { stringify } from 'viem';
import { NodeRequestManager } from '../src/index.js';

describe('Node.NodeRequestManager', () => {
  const defaultNoncePeriod = 1;
  let nodeRequestManager: NodeRequestManager;

  beforeEach(() => {
    nodeRequestManager = new NodeRequestManager({
      noncePeriod: defaultNoncePeriod,
    });
  });

  describe('#constructor', () => {
    it('should construct with correct noncePeriod', () => {
      expect(nodeRequestManager).to.have.property('noncePeriod', 1);
    });
  });

  describe('#setNoncePeriod', () => {
    it('should set new nonce period with string value', () => {
      nodeRequestManager.setNoncePeriod('5s');
      expect(nodeRequestManager).to.have.property('noncePeriod', 5);
    });

    it('should set new nonce period with number value', () => {
      nodeRequestManager.setNoncePeriod(7000);
      expect(nodeRequestManager).to.have.property('noncePeriod', 7000);
    });

    it('should throw of invalid nonce period provided', () => {
      expect(() => {
        nodeRequestManager.setNoncePeriod('50X');
      }).to.throw('Unknown duration time format');
    });
  });

  describe('#add', () => {
    it('should add request to cache', () => {
      const requestTopic = 'testTopic';
      const data = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });

      nodeRequestManager.add(requestTopic, data);
      expect(nodeRequestManager['cache'].has('1')).to.be.true;
    });

    it('should not add expired request to cache', () => {
      const requestTopic = 'testTopic';
      const data = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) - 20,
      });

      nodeRequestManager.add(requestTopic, data);
      expect(nodeRequestManager['cache'].has('1')).to.be.false;
    });

    it('should not add request that will expire before it can be processed', () => {
      const requestTopic = 'testTopic';
      const data = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000),
      });
      nodeRequestManager.add(requestTopic, data);
      expect(nodeRequestManager['cache'].has('1')).to.be.false;
    });

    it('should update request in cache if nonce is higher', () => {
      const requestTopic = 'testTopic';
      const data1 = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });
      const data2 = stringify({
        id: '1',
        nonce: 2,
        expire: Math.floor(Date.now() / 1000) + 20,
      });

      nodeRequestManager.add(requestTopic, data1);
      nodeRequestManager.add(requestTopic, data2);
      expect(nodeRequestManager['cache'].get('1')?.data.nonce).to.equal(2);
    });

    it('should not update request in cache if nonce is lower', () => {
      const requestTopic = 'testTopic';
      const data1 = stringify({
        id: '1',
        nonce: 2,
        expire: Math.floor(Date.now() / 1000) + 20,
      });
      const data2 = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });

      nodeRequestManager.add(requestTopic, data1);
      nodeRequestManager.add(requestTopic, data2);
      expect(nodeRequestManager['cache'].get('1')?.data.nonce).to.equal(2);
    });

    it('should not add request if data is not valid JSON', (done) => {
      const requestTopic = 'testTopic';
      const data = 'invalid JSON';
      const sizeBefore = nodeRequestManager['cache'].size;

      nodeRequestManager.addEventListener(
        'error',
        () => {
          expect(nodeRequestManager['cache'].size).to.eq(sizeBefore);
          done();
        },
        { once: true },
      );

      nodeRequestManager.add(requestTopic, data);
    });

    it('should emit request event after nonce period', (done) => {
      const requestTopic = 'testTopic';
      const data = stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });

      nodeRequestManager.addEventListener(
        'request',
        (event) => {
          expect(event.detail.topic).to.equal(requestTopic);
          expect(event.detail.data).to.deep.equal(JSON.parse(data));
          done();
        },
        { once: true },
      );

      nodeRequestManager.add(requestTopic, data);
    });
  });

  describe('#prune', () => {
    it('should remove expired requests from cache', () => {
      const requestTopic = 'testTopic';
      const data1 = JSON.stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });
      const data2 = JSON.stringify({
        id: '2',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) - 20,
      });

      nodeRequestManager.add(requestTopic, data1);
      nodeRequestManager.add(requestTopic, data2);
      nodeRequestManager.prune();

      expect(nodeRequestManager['cache'].has('1')).to.be.true;
      expect(nodeRequestManager['cache'].has('2')).to.be.false;
    });
  });

  describe('#clear', () => {
    it('should clear the cache', () => {
      const requestTopic = 'testTopic';
      const data = JSON.stringify({
        id: '1',
        nonce: 1,
        expire: Math.floor(Date.now() / 1000) + 20,
      });

      nodeRequestManager.add(requestTopic, data);
      nodeRequestManager.clear();

      expect(nodeRequestManager['cache'].size).to.equal(0);
    });
  });
});
