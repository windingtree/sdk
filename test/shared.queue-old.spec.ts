import './setup.js';
import { memoryStorage } from '../src/storage/index.js';
import {
  Queue,
  JobStatus,
  createJobHandler,
  JobHandlerClosure,
  Job,
} from '../src/shared/queue-old.js';
import { nowSec } from '../src/utils/time.js';
import { expect } from 'chai';

export interface JobData {
  shouldThrow: boolean;
  shouldFail: boolean;
  repeat: number;
  delay: number;
}

export interface JobConfiguration {
  name: string;
  data: JobData;
}

describe.skip('Shared.Queue OLD!!!', () => {
  const name = 'test';
  const totalJobs = 30;
  const minAttempts = 3;
  const maxAttempts = 5;
  const minDelay = 10;
  const maxDelay = 100;
  let queue: Queue;
  let jobs: JobConfiguration[];

  // eslint-disable-next-line @typescript-eslint/require-await
  before(async () => {
    jobs = Array(totalJobs)
      .fill(null)
      .map(() => {
        const shouldThrow = Math.random() < 0.5;
        const shouldFail = shouldThrow && Math.random() < 0.5;
        const repeatOpts = shouldThrow
          ? {
              repeat:
                Math.floor(Math.random() * (maxAttempts - minAttempts)) +
                minAttempts,
              delay:
                Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay,
            }
          : {};

        return {
          name: 'test',
          data: {
            shouldThrow,
            shouldFail,
            ...repeatOpts,
          },
        } as JobConfiguration;
      });
  });

  beforeEach(async () => {
    const storageInit = memoryStorage.createInitializer();
    queue = new Queue({
      storage: await storageInit(),
      hashKey: 'jobs',
      concurrentJobsNumber: 2,
    });
  });

  it('should process all jobs', (done) => {
    const { ok, fail } = jobs.reduce(
      (a, v) => ({
        ok:
          (!v.data.repeat && !v.data.shouldThrow) ||
          (v.data.repeat && !v.data.shouldFail)
            ? a.ok + 1
            : a.ok,
        fail: v.data.shouldFail ? a.fail + 1 : a.fail,
      }),
      { ok: 0, fail: 0 },
    );
    const result = {
      ok: 0,
      fail: 0,
    };

    const checkDone = () => {
      if (result.ok === ok && result.fail === fail) {
        done();
      }
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    const handler = createJobHandler<JobData>(async (job) => {
      if (
        (job.data.repeat && job.state.attempts < job.data.repeat) ||
        job.data.shouldFail
      ) {
        throw new Error('Should throw');
      }
    });

    queue.addJobHandler('test', handler());

    queue.addEventListener('done', () => {
      result.ok++;
      checkDone();
    });
    queue.addEventListener('fail', () => {
      result.fail++;
      checkDone();
    });

    jobs.forEach((job) =>
      queue.addJob<JobData>(job.name, job.data, {
        attempts: job.data.repeat,
        attemptsDelay: job.data.delay,
      }),
    );
  });

  it('should process recurrent jobs', (done) => {
    const counter = 5;
    const handler: JobHandlerClosure = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    queue.addJobHandler(name, handler);

    queue.addEventListener('cancel', ({ detail: job }) => {
      expect(job.state.status).to.eq(JobStatus.CANCELLED);
      done();
    });

    queue.addEventListener('done', ({ detail: job }) => {
      if (job.state.attempts === counter) {
        queue.cancelJob(job.id).catch(done);
      }
    });

    queue.addJob(
      name,
      {},
      {
        every: 100,
        attemptsDelay: 100,
      },
    );
  });

  it('should cancel recurrent job using handler return', (done) => {
    const counter = 5;
    const handler: JobHandlerClosure = async (job: Job) => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (job.state.attempts >= counter) {
        return true;
      }

      return;
    };

    queue.addJobHandler(name, handler);

    queue.addEventListener('cancel', ({ detail: job }) => {
      expect(job.state.status).to.eq(JobStatus.CANCELLED);
      done();
    });

    queue.addJob(
      name,
      {},
      {
        every: 100,
        attemptsDelay: 100,
      },
    );
  });

  it('should cancel recurrent job using max attempts option', (done) => {
    const counter = 5;
    const handler: JobHandlerClosure = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    queue.addJobHandler(name, handler);

    queue.addEventListener('cancel', ({ detail: job }) => {
      expect(job.state.status).to.eq(JobStatus.CANCELLED);
      done();
    });

    queue.addJob(
      name,
      {},
      {
        every: 100,
        attempts: counter,
        attemptsDelay: 100,
      },
    );
  });

  it('should cancel expired job', (done) => {
    const handler: JobHandlerClosure = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    queue.addJobHandler(name, handler);

    queue.addEventListener('expired', ({ detail: job }) => {
      expect(job.state.status).to.eq(JobStatus.EXPIRED);
      done();
    });

    queue.addJob(
      name,
      {},
      {
        every: 100,
        attemptsDelay: 100,
        expire: nowSec() + 1,
      },
    );
  });
});
