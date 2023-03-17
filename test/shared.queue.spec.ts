import './setup.js';
import { memoryStorage } from '../src/storage/index.js';
import { Queue, JobHandler } from '../src/shared/queue.js';

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

describe('Shared.Queue', () => {
  const totalJobs = 30;
  const minAttempts = 2;
  const maxAttempts = 10;
  const minDelay = 200;
  const maxDelay = 500;
  let queue: Queue;
  let jobs: JobConfiguration[];

  before(async () => {
    const storage = await memoryStorage.init()();
    queue = new Queue({
      storage,
      hashKey: 'jobs',
      concurrentJobsNumber: 2,
    });

    jobs = Array(totalJobs)
      .fill(null)
      .map(() => {
        const shouldThrow = Math.random() < 0.5;
        const shouldFail = shouldThrow && Math.random() < 0.5;
        const repeatOpts = shouldThrow
          ? {
              repeat: Math.floor(Math.random() * (maxAttempts - minAttempts)) + minAttempts,
              delay: Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay,
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

  it('should process all jobs', (done) => {
    const { ok, fail } = jobs.reduce(
      (a, v) => ({
        ok: !v.data.shouldThrow || (v.data.shouldThrow && !v.data.shouldFail) ? a.ok + 1 : a.ok,
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
    const handler: JobHandler<JobData> = async (job) => {
      if ((job.data.shouldThrow && job.state.attempts < job.data.repeat) || job.data.shouldFail) {
        throw new Error('Should throw');
      }
    };

    queue.addJobHandler('test', handler);

    queue.addEventListener('done', () => {
      result.ok++;
      checkDone();
    });
    queue.addEventListener('fail', () => {
      result.fail++;
      checkDone();
    });

    jobs.forEach((job) =>
      queue.addJob(job.name, job.data, {
        repeat: job.data.repeat,
        delay: job.data.delay,
      }),
    );
  });
});
