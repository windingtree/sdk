import './setup.js';
import { z } from 'zod';
import { memoryStorage } from '../src/storage/index.js';
import { Queue, JobHandler } from '../src/shared/queue.js';

export const JobDataSchema = z
  .object({
    shouldThrow: z.boolean(),
    shouldFail: z.boolean(),
    repeat: z.number(),
    delay: z.number(),
  })
  .partial();

export type JobData = z.infer<typeof JobDataSchema>;

export interface JobConfiguration {
  name: string;
  data: JobData;
}

describe('Shared.Queue', () => {
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

  beforeEach(async () => {
    const storage = await memoryStorage.init()();
    queue = new Queue({
      storage,
      hashKey: 'jobs',
      concurrentJobsNumber: 2,
    });
  });

  it('should process all jobs', (done) => {
    const { ok, fail } = jobs.reduce(
      (a, v) => ({
        ok:
          (!v.data.repeat && !v.data.shouldThrow) || (v.data.repeat && !v.data.shouldFail)
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
    const handler: JobHandler<JobData> = async (job) => {
      if ((job.data.repeat && job.state.attempts < job.data.repeat) || job.data.shouldFail) {
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
      queue.addJob<JobData>(
        job.name,
        job.data,
        {
          attempts: job.data.repeat,
          attemptsDelay: job.data.delay,
        },
        JobDataSchema,
      ),
    );
  });

  it('should process recurrent jobs', (done) => {
    const name = 'test';
    const counter = 10;
    const handler: JobHandler<JobData> = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    queue.addJobHandler(name, handler);

    queue.addEventListener('cancel', () => {
      done();
    });

    queue.addEventListener('done', ({ detail: job }) => {
      if (job.state.attempts === counter) {
        queue.cancelJob(job.id).catch(done);
      }
    });

    queue.addJob<JobData>(
      name,
      {},
      {
        every: 100,
        attemptsDelay: 100,
      },
    );
  });
});
