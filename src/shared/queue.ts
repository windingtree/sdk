import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { z } from 'zod';
import { Storage } from '../storage/index.js';
import { queueConcurrentJobsNumber, queueJobAttemptsDelay, queueHeartbeat } from '../constants.js';
import { simpleUid } from '../utils/uid.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queue');

/**
 * Queue options schema
 */
export const QueueOptionsSchema = z
  .object({
    /** Queue storage object. See available options here: ./storage */
    storage: z.instanceof(Storage),
    /** Name of key for storing current queued jobs */
    hashKey: z.string().default('jobKeys'),
    /** Maximum jobs at once */
    concurrentJobsNumber: z.number().int().default(queueConcurrentJobsNumber),
    /** Queue heartbeat interval time in milliseconds */
    heartbeat: z.number().int().default(queueHeartbeat),
  })
  .strict();

export type QueueOptions = z.infer<typeof QueueOptionsSchema>;

/**
 * Queue initialization options schema
 */
export const QueueInitSchema = QueueOptionsSchema.partial().required({ storage: true });

export type QueueInit = z.infer<typeof QueueInitSchema>;

/**
 * Job configuration options schema
 */
export const JobOptionsSchema = z
  .object({
    /** Maximum number of attempts when a job is failing */
    attempts: z.number().int().nonnegative().default(0),
    /** Delay between attempts in milliseconds */
    attemptsDelay: z.number().int().nonnegative().default(queueJobAttemptsDelay),
    /** Interval time for scheduled jobs in milliseconds */
    every: z.number().int().nonnegative().optional(),
    /** Job expiration time in seconds */
    expire: z.number().int().nonnegative().optional(),
  })
  .strict();

export type JobOptions = z.infer<typeof JobOptionsSchema>;

/**
 * Allowed job statuses
 */
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

/**
 * Internal job state schema
 */
export const JobStateSchema = z
  .object({
    /** Current job status */
    status: JobStatusSchema.default(JobStatuses.PENDING),
    /** Job run attempts made */
    attempts: z.number().int().nonnegative().default(0),
    /** Scheduled run time */
    scheduled: z.number().int().nonnegative().optional(),
    errors: z
      /** Array with errors occurred */
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

/**
 * Creates job schema
 *
 * @param {z.ZodType} dataSchema
 * @returns {z.ZodType}
 */
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

/**
 * Job type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Job<JobDataType = any> = z.infer<ReturnType<typeof createJobSchema<JobDataType>>>;

/**
 * Job handler function type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler<OfferData = any, HandlerOptions extends object = object> = (
  job: Job<OfferData>,
  options?: HandlerOptions,
) => Promise<boolean | void>;

/**
 * Job handler closure type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandlerClosure = (job: any) => ReturnType<JobHandler<any>>;

/**
 * Job handler function factory
 *
 * @example
 *
 * const handler = createJobHandler<JobData, HandlerOptions>(
 *  async ({ name, id, data }, options) => {
 *    logger.trace(`Job "${name}" #${id}...`);
 *    // ...
 *  },
 * );
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const createJobHandler =
  <OfferData = any, HandlerOptions extends object = object>(
    handler: JobHandler<OfferData, HandlerOptions>,
  ) =>
  (options?: HandlerOptions) =>
  (job: Job<OfferData>) =>
    handler(job, options);
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Queue events interface
 */
export interface QueueEvents {
  /**
   * @example
   *
   * ```js
   * queue.addEventListener('job', ({ detail: job }) => {
   *    // job added
   * })
   * ```
   */
  job: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('done', ({ detail: job }) => {
   *    // job - finished
   * })
   * ```
   */
  done: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('error', ({ detail: job }) => {
   *    // job - errored job
   * })
   * ```
   */
  error: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('cancel', ({ detail: job }) => {
   *    // job - cancelled job
   * })
   * ```
   */
  cancel: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('fail', ({ detail: job }) => {
   *    // job - failed job
   * })
   * ```
   */
  fail: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('expired', ({ detail: job }) => {
   *    // job - expired job
   * })
   * ```
   */
  expired: CustomEvent<Job>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('scheduled', ({ detail: job }) => {
   *    // job - scheduled job
   * })
   * ```
   */
  scheduled: CustomEvent<Job>;
}

/**
 * Queue manager
 *
 * @class Queue
 * @extends {EventEmitter<QueueEvents>}
 */
export class Queue extends EventEmitter<QueueEvents> {
  private storage: Storage;
  private hashKey: string;
  /** All jobs in queue */
  private jobs: Set<string>;
  /** Jobs in operation at the moment */
  private liveJobs: Set<string>;
  /** Job handlers registry */
  private jobHandlers: Map<string, JobHandlerClosure>;
  private concurrentJobsNumber: number;
  private heartbeat: number;
  /** Queue processing status */
  private processing: boolean;
  private heartbeatInterval?: NodeJS.Timeout;

  /**
   * Creates Queue instance
   *
   * @param {QueueInit} options Queue initialization options
   */
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
    this.jobHandlers = new Map<string, JobHandlerClosure>();
    this.processing = false;
    this._init().catch(logger.error);
    logger.trace('Queue instantiated');
  }

  /**
   * Starts queue
   *
   * @returns {Promise<void>}
   */
  private async _init(): Promise<void> {
    if (this.heartbeatInterval) {
      return;
    }

    const rawJobKeys = await this.storage.get<string>(this.hashKey);

    if (rawJobKeys) {
      new Set<string>(JSON.parse(rawJobKeys) as string[]);
    }

    /** Heartbeat callback */
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

  /**
   * Synchronize queue state with storage
   *
   * @returns {Promise<void>}
   */
  private async _sync() {
    await this.storage.set(this.hashKey, JSON.stringify(Array.from(this.jobs)));
    logger.trace('Storage synced');
  }

  /**
   * Picks a certain amount of jobs to run
   *
   * @returns {Promise<Job[]>}
   */
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

  /**
   * Updates job state
   *
   * @param {Job} job Job to update
   * @param {Partial<JobState>} state New job state parameters
   * @returns {Promise<Job>} Updated job
   */
  private async _updatedJobState(job: Job, state: Partial<JobState>): Promise<Job> {
    job.state = JobStateSchema.parse({
      ...job.state,
      ...state,
    });
    await this.storage.set(job.id, job);
    logger.trace(`Job #${job.id} state updated`, job);
    return job;
  }

  /**
   * Executes a job
   *
   * @param {Job} job Job to start
   * @returns {Promise<void>}
   */
  private async _doJob(job: Job): Promise<void> {
    try {
      const callback = this.jobHandlers.get(job.name);

      if (!callback) {
        throw new Error(`Handler for job #${job.id} not found`);
      }

      if (job.state.status === JobStatuses.FAILED) {
        throw new Error(`Job #${job.id} already failed`);
      }

      /** Expired job must be removed from queue */
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

  /**
   * Runs queue iteration
   *
   * @returns {Promise<void>}
   */
  private async _process() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const jobs = await this._pickJobs();
    logger.trace(`Picked #${jobs.length} jobs`);

    if (jobs.length > 0) {
      await Promise.allSettled(
        jobs.map((job) =>
          this._doJob(job)
            .then(() => logger.trace(`Job #${job.id} fulfilled`))
            .catch((error) => logger.error(`Job #${job.id} error`, error)),
        ),
      );
    }

    this.processing = false;
  }

  /**
   * Registers a job handler
   *
   * @param {string} name Job name
   * @param {JobHandlerClosure} callback Job handler
   */
  addJobHandler(name: string, callback: JobHandlerClosure) {
    this.jobHandlers.set(name, callback);
    logger.trace(`Added #${name} handler`);
  }

  /**
   * Removes handler from the registry
   *
   * @param {string} name Job name
   */
  deleteJobHandler(name: string) {
    this.jobHandlers.delete(name);
    logger.trace(`Deleted #${name} handler`);
  }

  /**
   * Adds job
   *
   * @param {string} name Job name
   * @param {JobDataType} data Job data
   * @param {Partial<JobOptions>} options Job options, optional
   * @param {z.ZodType<JobDataType>} dataSchema Job data validation schema
   * @returns {Job} Added job
   *
   * @example
   *
   * queue.addJob('someJob', data, {
   *  expire: 168001626,
   *  every: 5000,
   * });
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addJob<JobDataType = any>(
    name: string,
    data: JobDataType,
    options?: Partial<JobOptions>,
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

  /**
   * Gets gob from storage by Id
   *
   * @param {string} id Job id
   * @returns {Promise<Job>}
   */
  async getJob(id: string): Promise<Job> {
    const job = await this.storage.get<Job>(id);

    if (!job) {
      throw new Error(`Job $${id} not found`);
    }

    return job;
  }

  /**
   * Cancels and deletes a job by Id
   *
   * @param {string} id Job id
   * @returns {Promise<void>}
   */
  async cancelJob(id: string) {
    if (!this.jobs.has(id)) {
      throw new Error(`Job #${id} not in the queue`);
    }

    let job = await this.storage.get<Job>(id);

    if (!job) {
      throw new Error(`Job #${id} not found`);
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
