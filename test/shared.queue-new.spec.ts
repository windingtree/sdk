/* eslint-disable @typescript-eslint/require-await */
import { expect } from 'chai';
import {
  Job,
  JobStatus,
  Queue,
  JobHandler,
  JobConfig,
  JobData,
  JobHandlerRegistry,
} from '../src/shared/queue-new.js';

describe('Job', function () {
  let config: JobConfig;
  let handler: JobHandler;

  beforeEach(function () {
    config = {
      handlerName: 'testHandler',
      data: {},
    };
    handler = async () => true; // sample job handler
  });

  it('should create a new job with pending status', function () {
    const job = new Job(config);
    expect(job.status).to.equal(JobStatus.Pending);
  });

  it('should correctly set job status', function () {
    const job = new Job(config);
    job.status = JobStatus.Started;
    expect(job.status).to.equal(JobStatus.Started);
  });

  it('should correctly identify expired job', function () {
    const expiredConfig = { ...config, expire: -1 }; // set expiration time in the past
    const job = new Job(expiredConfig);
    expect(job.expired).to.be.true;
    expect(job.status).to.equal(JobStatus.Expired);
  });

  it('should correctly identify executable job', function () {
    const job = new Job(config);
    expect(job.executable).to.be.true;
  });

  it('should correctly identify non-executable job', function () {
    const job = new Job(config);
    job.status = JobStatus.Started;
    expect(job.executable).to.be.false;
  });

  it('should correctly execute job handler', async function () {
    const job = new Job(config);
    const result = await job.execute(handler);
    expect(result).to.be.true;
  });

  it('should correctly handle failed job execution', function (done) {
    const failingHandler = async () => {
      throw new Error('Job failed');
    };
    const job = new Job(config);
    job.execute(failingHandler).catch((err) => {
      expect((err as Error).message).to.equal('Job failed');
      done();
    });
  });
});

describe('JobHandlerRegistry', () => {
  let registry: JobHandlerRegistry;
  let sampleHandler: JobHandler;

  beforeEach(function () {
    registry = new JobHandlerRegistry();
    sampleHandler = async () => true; // sample job handler
  });

  it('should be able to register a handler', function () {
    registry.register('test', sampleHandler);
    expect(registry.handlers.has('test')).to.be.true;
  });

  it('should be able to get a registered handler', function () {
    registry.register('test', sampleHandler);
    const handler = registry.getHandler('test');
    expect(handler).to.be.eq(sampleHandler);
  });

  it('should throw an error when trying to get a handler that does not exist', function () {
    expect(() => registry.getHandler('nonexistent')).to.throw;
  });

  it('should not allow to register a handler with a name that already exists', function () {
    registry.register('test', sampleHandler);
    expect(() => registry.register('test', sampleHandler)).to.throw;
  });
});

describe('Queue', function () {
  let config: JobConfig;
  let handler: JobHandler<JobData>;
  let queue: Queue;

  beforeEach(function () {
    config = {
      handlerName: 'testHandler',
      data: {},
    };

    handler = async () => Promise.resolve(true);

    queue = new Queue({ concurrencyLimit: 5 });
    queue.registerHandler('testHandler', handler);
  });

  it('should add and execute a job', async function () {
    let jobId: string;

    await new Promise<void>((resolve) => {
      queue.addEventListener(
        'stop',
        () => {
          expect(queue.get(jobId)?.status).to.equal(JobStatus.Done);
          resolve();
        },
        { once: true },
      );

      jobId = queue.add(config);
    });
  });

  it('should cancel a job', function () {
    const jobId = queue.add(config);
    expect(queue.cancel(jobId)).to.be.true;
    expect(queue.get(jobId)?.status).to.equal(JobStatus.Cancelled);
  });

  it('should not cancel a non-existent job', function () {
    expect(queue.cancel('nonExistentJobId')).to.be.false;
  });

  it('should delete a job', function () {
    const jobId = queue.add(config);
    expect(queue.delete(jobId)).to.be.true;
    expect(queue.get(jobId)).to.be.undefined;
  });

  it('should not delete a non-existent job', function () {
    expect(queue.delete('nonExistentJobId')).to.be.false;
  });

  it('should not exceed concurrency limit', async function () {
    const concurrencyLimit = 2;

    queue = new Queue({ concurrencyLimit });
    queue.registerHandler('testHandler', handler);

    await new Promise<void>((resolve) => {
      queue.addEventListener(
        'stop',
        () => {
          expect(
            queue.jobs.filter((job) => job.status === JobStatus.Started).length,
          ).to.equal(concurrencyLimit);
          resolve();
        },
        { once: true },
      );

      for (let i = 0; i < 5; i++) {
        queue.add(config);
      }
    });
  });

  describe('recurrent jobs', () => {
    let queue: Queue;

    beforeEach(() => {
      queue = new Queue({ concurrencyLimit: 1 });
    });

    it('should correctly handle recurrent jobs', async () => {
      const maxRecurrences = 3;
      let count = 0;

      const handler = async () => {
        return true;
      };
      queue.registerHandler('recurrent', handler);

      await new Promise<void>((resolve) => {
        queue.addEventListener('stop', () => {
          if (count >= maxRecurrences) {
            resolve();
          }
          count++;
        });

        // Add a recurrent job that should run every 10ms
        queue.add({
          handlerName: 'recurrent',
          isRecurrent: true,
          recurrenceInterval: 10,
          maxRecurrences,
        });
      });
    });

    it('should correctly stop recurrent jobs by returning false from handler', async () => {
      const maxRecurrences = 5;
      const exitStep = 2;
      let count = 0;
      let timer: NodeJS.Timeout;

      const handler = async () => {
        count++;
        if (count === exitStep) {
          return false;
        }
        return true;
      };
      queue.registerHandler('recurrent', handler);

      await new Promise<void>((resolve) => {
        queue.addEventListener('stop', () => {
          clearTimeout(timer);
          timer = setTimeout(resolve, maxRecurrences * 2);
        });

        // Add a recurrent job that should run every 10ms
        queue.add({
          handlerName: 'recurrent',
          isRecurrent: true,
          recurrenceInterval: 10,
          maxRecurrences,
        });
      });

      expect(count).to.be.eq(exitStep);
    });
  });
});
