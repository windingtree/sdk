import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { z } from 'zod';
import { Storage } from '../storage/index.js';
import { queueConcurrentJobsNumber, queueJobAttemptsDelay, queueHeartbeat } from '../constants.js';
import { simpleUid } from '../utils/uid.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queue');

export const QueueOptionsSchema = z
  .object({
    storage: z.instanceof(Storage),
    hashKey: z.string().default('jobKeys'),
    concurrentJobsNumber: z.number().int().default(queueConcurrentJobsNumber),
    heartbeat: z.number().int().default(queueHeartbeat),
  })
  .strict();

export type QueueOptions = z.infer<typeof QueueOptionsSchema>;

export const QueueInitSchema = QueueOptionsSchema.partial().required({ storage: true });

export type QueueInit = z.infer<typeof QueueInitSchema>;

export const JobOptionsSchema = z
  .object({
    attempts: z.number().int().nonnegative().default(0), // Maximum number of attempts when a job is failing
    attemptsDelay: z.number().int().nonnegative().default(queueJobAttemptsDelay), // Delay between attempts in milliseconds
    every: z.number().int().nonnegative().optional(), // Interval time for scheduled jobs in milliseconds
    expire: z.number().int().nonnegative().optional(), // Job expiration time in seconds
  })
  .strict();

export type JobOptions = z.infer<typeof JobOptionsSchema>;

export const JobOptionsInitSchema = JobOptionsSchema.partial();

export type JobOptionsInit = z.infer<typeof JobOptionsInitSchema>;

export enum JobStatuses {
  PENDING,
  STARTED,
  DONE,
  CANCELLED,
  ERRORED,
  FAILED,
  EXPIRED,
}

export const JobStatusSchema = z.nativeEnum(JobStatuses);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobStateSchema = z
  .object({
    status: JobStatusSchema.default(JobStatuses.PENDING),
    attempts: z.number().int().nonnegative().default(0),
    scheduled: z.number().int().nonnegative().optional(),
    errors: z
      .array(
        z.object({
          time: z.number(),
          error: z.string(),
        }),
      )
      .default([]),
  })
  .strict();

export type JobState = z.infer<typeof JobStateSchema>;

export const createJobSchema = <JobDataType = unknown>(dataSchema: z.ZodType<JobDataType>) =>
  z
    .object({
      id: z.string(),
      name: z.string(),
      data: dataSchema,
      options: JobOptionsSchema,
      state: JobStateSchema,
    })
    .strict();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Job<JobDataType = any> = z.infer<ReturnType<typeof createJobSchema<JobDataType>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler<JobDataType = any> = (data: Job<JobDataType>) => Promise<boolean | void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueueEvents {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('job', ({ detail: job }) => {
   *    // job added
   * })
   * ```
   */
  job: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('done', ({ detail: job }) => {
   *    // job - finished
   * })
   * ```
   */
  done: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('error', ({ detail: job }) => {
   *    // job - errored job
   * })
   * ```
   */
  error: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('cancel', ({ detail: job }) => {
   *    // job - cancelled job
   * })
   * ```
   */
  cancel: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('fail', ({ detail: job }) => {
   *    // job - failed job
   * })
   * ```
   */
  fail: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('expired', ({ detail: job }) => {
   *    // job - expired job
   * })
   * ```
   */
  expired: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('scheduled', ({ detail: job }) => {
   *    // job - scheduled job
   * })
   * ```
   */
  scheduled: CustomEvent<Job>;
}

export class Queue extends EventEmitter<QueueEvents> {
  private storage: Storage;
  private hashKey: string;
  private jobs: Set<string>;
  private liveJobs: Set<string>;
  private jobHandlers: Map<string, JobHandler>;
  private concurrentJobsNumber: number;
  private heartbeat: number;
  private processing: boolean;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(options: QueueInit) {
    super();

    options = QueueOptionsSchema.parse(options);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.hashKey = options.hashKey!; // Has a default value
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.concurrentJobsNumber = options.concurrentJobsNumber!; // Has a default value
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.heartbeat = options.heartbeat!; // Has a default value
    this.storage = options.storage;
    this.jobs = new Set<string>();
    this.liveJobs = new Set<string>();
    this.jobHandlers = new Map<string, JobHandler>();
    this.processing = false;
    this._init().catch(logger.error);
  }

  private async _init() {
    if (this.heartbeatInterval) {
      logger.trace('_init: heartbeat On', this.heartbeatInterval);
      return;
    }

    const rawJobKeys = await this.storage.get<string>(this.hashKey);

    if (rawJobKeys) {
      new Set<string>(JSON.parse(rawJobKeys) as string[]);
    }

    const tick = () => {
      if (this.jobs.size > 0) {
        this._process().catch(logger.error);
        return;
      }

      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      logger.trace('Queue interval cleared');
    };

    this.heartbeatInterval = setInterval(tick.bind(this), this.heartbeat);
  }

  private async _sync(): Promise<void> {
    await this.storage.set(this.hashKey, JSON.stringify(Array.from(this.jobs)));
    logger.trace('Storage synced');
  }

  private async _pickJobs(): Promise<Job[]> {
    const size = this.concurrentJobsNumber - this.liveJobs.size;
    const jobs: Job[] = [];
    logger.trace(`Trying to pick #${size} jobs. Keys size #${this.jobs.size}`);

    for (const key of this.jobs.values()) {
      if (jobs.length === size) {
        logger.trace(`Picked enough #${jobs.length}`);
        break;
      }

      if (!this.liveJobs.has(key)) {
        const job = await this.storage.get<Job>(key);

        if (!job) {
          throw new Error(`Job #${key} not found`);
        }

        if (job.state.status === JobStatuses.CANCELLED) {
          logger.trace(`Cancelled job #${job.id} skipped`);
          continue;
        }

        if (job.state.scheduled && job.state.scheduled > Date.now()) {
          logger.trace(`Scheduled job #${job.id} skipped`);
          continue;
        }

        jobs.push(job);
        logger.trace(`Job #${job.id} picked`, job);
      }
    }

    return jobs;
  }

  private async _updatedJobState(job: Job, state: Partial<JobState>): Promise<Job> {
    job.state = JobStateSchema.parse({
      ...job.state,
      ...state,
    });
    await this.storage.set(job.id, job);
    logger.trace(`Job #${job.id} state updated`, job);
    return job;
  }

  private async _doJob(job: Job): Promise<void> {
    try {
      const callback = this.jobHandlers.get(job.name);

      if (!callback) {
        throw new Error(`Handler for job #${job.id} not found`);
      }

      if (job.state.status === JobStatuses.FAILED) {
        throw new Error(`Job #${job.id} already failed`);
      }

      // Expired job must be removed from queue
      if (job.options.expire && job.options.expire * 1000 <= Date.now()) {
        logger.trace(`Job #${job.id} expired at: ${job.options.expire}`);

        const prevStatus =
          job.state.status === JobStatuses.ERRORED ? JobStatuses.FAILED : JobStatuses.DONE;
        job = await this._updatedJobState(job, { status: JobStatuses.EXPIRED });

        this.jobs.delete(job.id);
        await this._sync();
        this.liveJobs.delete(job.id);

        this.dispatchEvent(
          new CustomEvent<Job>(prevStatus === JobStatuses.DONE ? 'done' : 'fail', {
            detail: job,
          }),
        );

        this.dispatchEvent(
          new CustomEvent<Job>('expired', {
            detail: job,
          }),
        );
        return;
      }

      job = await this._updatedJobState(job, {
        status: JobStatuses.STARTED,
      });
      logger.trace(`Starting job #${job.id}`, job);

      const shouldCancel = await Promise.resolve(callback(job));

      if (job.options.every && !shouldCancel) {
        if (job.options.attempts && job.state.attempts >= job.options.attempts) {
          logger.trace(`Job #${job.id} should be cancelled (attempts rule)`);
          await this.cancelJob(job.id);
          return;
        }

        job = await this._updatedJobState(job, {
          status: JobStatuses.PENDING,
          scheduled: Date.now() + job.options.every,
          attempts: job.state.attempts + 1,
        });
        logger.trace(`Job #${job.id} scheduled`, job);

        this.dispatchEvent(
          new CustomEvent<Job>('done', {
            detail: job,
          }),
        );

        this.dispatchEvent(
          new CustomEvent<Job>('scheduled', {
            detail: job,
          }),
        );
      } else if (shouldCancel) {
        logger.trace(`Job #${job.id} should be cancelled (handler rule)`);
        await this.cancelJob(job.id);
        return;
      } else {
        job = await this._updatedJobState(job, {
          status: JobStatuses.DONE,
        });

        this.jobs.delete(job.id);
        await this._sync();
        logger.trace(`Job #${job.id} done`, job);

        this.dispatchEvent(
          new CustomEvent<Job>('done', {
            detail: job,
          }),
        );
      }

      this.liveJobs.delete(job.id);
    } catch (error) {
      logger.error(`Job #${job.id} error:`, error);

      job = await this._updatedJobState(job, {
        status: JobStatuses.ERRORED,
        errors: [
          ...(job.state.errors ?? []),
          {
            time: Date.now(),
            error: (error as Error).stack || (error as Error).message,
          },
        ],
      });
      logger.trace(`Job #${job.id} errored`, job);

      this.dispatchEvent(
        new CustomEvent<Job>('error', {
          detail: job,
        }),
      );

      if (
        job.options.attempts &&
        job.options.attempts > 0 &&
        job.state.attempts < job.options.attempts
      ) {
        job = await this._updatedJobState(job, {
          attempts: job.state.attempts + 1,
          scheduled: Date.now() + job.options.attemptsDelay,
        });
        logger.trace(`Errored job #${job.id} scheduled`, job);

        this.liveJobs.delete(job.id);

        this.dispatchEvent(
          new CustomEvent<Job>('scheduled', {
            detail: job,
          }),
        );
        return;
      }

      job = await this._updatedJobState(job, {
        status: JobStatuses.FAILED,
      });

      this.jobs.delete(job.id);
      await this._sync();
      this.liveJobs.delete(job.id);
      logger.trace(`Job #${job.id} failed`, job);

      this.dispatchEvent(
        new CustomEvent<Job>('fail', {
          detail: job,
        }),
      );
    }
  }

  private async _process() {
    if (this.processing) {
      logger.trace('Ignore: processing');
      return;
    }

    this.processing = true;
    const jobs = await this._pickJobs();
    logger.trace(`Picked #${jobs.length} jobs`);

    if (jobs.length > 0) {
      for (const job of jobs) {
        this._doJob(job).catch(logger.error);
      }
    }

    this.processing = false;
  }

  addJobHandler(name: string, callback: JobHandler) {
    this.jobHandlers.set(name, callback);
    logger.trace(`Added #${name} handler`);
  }

  deleteJobHandler(name: string) {
    this.jobHandlers.delete(name);
    logger.trace(`Deleted #${name} handler`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addJob<JobDataType = any>(
    name: string,
    data: JobDataType,
    options?: JobOptionsInit,
    dataSchema: z.ZodType<JobDataType> = z.any(),
  ): Job {
    if (!this.jobHandlers.has(name)) {
      throw new Error(`Job handler with name #${name} not registered yet`);
    }

    const jobId = simpleUid();
    const job = createJobSchema(dataSchema).parse({
      id: jobId,
      name,
      data,
      options,
      state: {},
    });
    this.storage
      .set<Job>(jobId, job)
      .then(() => {
        this.jobs.add(jobId);
        logger.trace(`Added job Id #${jobId}`);
      })
      .then(() => {
        logger.trace(`Added job #${jobId}`, job);
        this.dispatchEvent(
          new CustomEvent('job', {
            detail: job,
          }),
        );
      })
      .then(() => this._sync())
      .then(() => this._init())
      .catch(logger.error);

    return job;
  }

  async getJob(key: string): Promise<Job> {
    const job = await this.storage.get<Job>(key);

    if (!job) {
      throw new Error(`Job $${key} not found`);
    }

    return job;
  }

  async cancelJob(key: string): Promise<void> {
    if (!this.jobs.has(key)) {
      throw new Error(`Job #${key} not in the queue`);
    }

    let job = await this.storage.get<Job>(key);

    if (!job) {
      throw new Error(`Job #${key} not found`);
    }

    job = await this._updatedJobState(job, {
      status: JobStatuses.CANCELLED,
    });

    this.jobs.delete(job.id);
    await this._sync();
    this.liveJobs.delete(job.id);
    logger.trace(`Job #${job.id} cancelled`, job);

    this.dispatchEvent(
      new CustomEvent<Job>('cancel', {
        detail: job,
      }),
    );
  }
}
