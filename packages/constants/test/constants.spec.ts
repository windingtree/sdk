import { describe, expect, it } from '@windingtree/sdk-test-utils';
import {
  defaultExpirationTime,
  noncePeriod,
  outboundStreamDelay,
  queueConcurrentJobsNumber,
  queueHeartbeat,
  queueJobAttemptsDelay,
} from '../src/index.js';

describe('Node', () => {
  it('defaultExpirationTime should be defined', () => {
    expect(defaultExpirationTime).toBeDefined();
  });

  it('outboundStreamDelay should be defined', () => {
    expect(outboundStreamDelay).toBeDefined();
  });

  it('noncePeriod should be defined', () => {
    expect(noncePeriod).toBeDefined();
  });

  it('queueConcurrentJobsNumber should be defined', () => {
    expect(queueConcurrentJobsNumber).toBeDefined();
  });

  it('queueJobAttemptsDelay should be defined', () => {
    expect(queueJobAttemptsDelay).toBeDefined();
  });

  it('queueHeartbeat should be defined', () => {
    expect(queueHeartbeat).toBeDefined();
  });
});
