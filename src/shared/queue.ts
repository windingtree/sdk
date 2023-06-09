import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { simpleUid } from '@windingtree/contracts';
import { Storage } from '../storage/index.js';
import { queueConcurrentJobsNumber, queueJobAttemptsDelay, queueHeartbeat } from '../constants.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queue');

export interface QueueOptions {
  /** Queue storage object. See available options here: ./storage */
  storage: Storage;
  /** Name of key for storing current queued jobs */
  hashKey: string;
  /** Maximum jobs at once */
  concurrentJobsNumber: number;
  /** Queue heartbeat interval time in milliseconds */
  heartbeat: number;
}

/**
 * Queue initialization options
 */
export type QueueInit = Partial<QueueOptions> & Pick<QueueOptions, 'storage'>;

/**
 * Queue job options
 */
export interface JobOptions {
  /** Maximum number of attempts when a job is failing */
  attempts: number;
  /** Delay between attempts in milliseconds */
  attemptsDelay: number;
  /** Interval time for scheduled jobs in milliseconds */
  every?: number;
  /** Job expiration time in seconds */
  expire?: number;
}

/**
 * Allowed job statuses
 */
export enum JobStatus {
  PENDING,
  STARTED,
  DONE,
  CANCELLED,
  ERRORED,
  FAILED,
  EXPIRED,
}

/**
 * Internal job state type
 */
export interface JobState {
  /** Current job status */
  status: JobStatus;
  /** Job run attempts made */
  attempts: number;
  /** Scheduled run time */
  scheduled?: number;
  /** Array with errors occurred */
  errors: {
    time: number;
    error: string;
  }[];
}

/**
 * Job type
 */
export interface Job<JobDataType = unknown> {
  id: string;
  name: string;
  data: JobDataType;
  options: JobOptions;
  state: JobState;
}

/**
 * Job handler function type
 */
export type JobHandler<OfferData = unknown, HandlerOptions extends object = object> = (
  job: Job<OfferData>,
  options: HandlerOptions,
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
  (options: HandlerOptions) =>
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

    const { hashKey, concurrentJobsNumber, heartbeat, storage } = options;

    // @todo Validate Queue initialization options

    this.hashKey = hashKey ?? 'jobsKeys';
    this.concurrentJobsNumber = concurrentJobsNumber ?? queueConcurrentJobsNumber;
    this.heartbeat = heartbeat ?? queueHeartbeat;
    this.storage = storage;
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
  private async _sync(): Promise<void> {
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

        if (job.state.status === JobStatus.CANCELLED) {
          logger.trace(`Cancelled job #${job.id} skipped`);
          continue;
        }

        if (job.state.scheduled && job.state.scheduled > Date.now()) {
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
    // @todo Validate state argument

    job.state = {
      ...job.state,
      ...state,
    };
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

      if (job.state.status === JobStatus.FAILED) {
        throw new Error(`Job #${job.id} already failed`);
      }

      /** Expired job must be removed from queue */
      if (job.options.expire && job.options.expire * 1000 <= Date.now()) {
        logger.trace(`Job #${job.id} expired at: ${job.options.expire}`);

        const prevStatus =
          job.state.status === JobStatus.ERRORED ? JobStatus.FAILED : JobStatus.DONE;
        job = await this._updatedJobState(job, { status: JobStatus.EXPIRED });

        this.jobs.delete(job.id);
        await this._sync();
        this.liveJobs.delete(job.id);

        this.dispatchEvent(
          new CustomEvent<Job>(prevStatus === JobStatus.DONE ? 'done' : 'fail', {
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
        status: JobStatus.STARTED,
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
          status: JobStatus.PENDING,
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
          status: JobStatus.DONE,
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
        status: JobStatus.ERRORED,
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
        status: JobStatus.FAILED,
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
  private async _process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const jobs = await this._pickJobs();

    if (jobs.length > 0) {
      logger.trace(`Picked #${jobs.length} jobs`);

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
  addJob<JobDataType = unknown>(
    name: string,
    data: JobDataType,
    options?: Partial<JobOptions>,
  ): Job {
    if (!this.jobHandlers.has(name)) {
      throw new Error(`Job handler with name #${name} not registered yet`);
    }

    const jobId = simpleUid();
    const job: Job<JobDataType> = {
      id: jobId,
      name,
      data,
      options: {
        attempts: 0,
        attemptsDelay: queueJobAttemptsDelay,
        ...options,
      },
      state: {
        status: JobStatus.PENDING,
        attempts: 0,
        errors: [],
      },
    };

    // @todo Validate job data

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
      status: JobStatus.CANCELLED,
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
