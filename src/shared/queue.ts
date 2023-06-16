import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { simpleUid } from '@windingtree/contracts';
import { Storage } from '../storage/index.js';
import { backoffWithJitter } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queue');

/**
 * Enum to represent the different states a job can be in.
 */
export enum JobStatus {
  Pending,
  Started,
  Done,
  Cancelled,
  Failed,
  Expired,
}

/**
 * Type for the data that a job can operate on.
 */
export type JobData = unknown;

/**
 * Interface for the function that a job runs.
 */
export type JobHandler<JobData = unknown, HandlerOptions = unknown> = (
  data?: JobData,
  options?: HandlerOptions,
) => Promise<boolean>;

export interface JobHistoryInterface {
  /** A history of all status changes for the job. */
  statusChanges?: { timestamp: number; status: JobStatus }[];
  /** A history of all errors for the job. */
  errors?: string[];
}

/**
 * A class to manage the history of a job. This includes status changes and errors.
 *
 * @export
 * @class JobHistory
 */
export class JobHistory implements JobHistoryInterface {
  /** A history of all status changes for the job. */
  statusChanges: { timestamp: number; status: JobStatus }[];
  /** A history of all errors for the job. */
  errors: string[];

  /**
   * Creates an instance of JobHistory.
   * @memberof JobHistory
   */
  constructor(config: JobHistoryInterface) {
    this.statusChanges = config.statusChanges ?? [];
    this.errors = config.errors ?? [];
  }

  static getStatus(source: JobHistory | JobHistoryInterface) {
    return source.statusChanges && source.statusChanges.length > 0
      ? source.statusChanges[source.statusChanges.length - 1].status
      : JobStatus.Pending;
  }

  /**
   * Returns class as object
   *
   * @returns
   * @memberof JobHistory
   */
  toJSON(): JobHistoryInterface {
    return {
      statusChanges: this.statusChanges,
      errors: this.errors,
    };
  }
}

/**
 * Configuration object for a job.
 */
export interface JobConfig<T extends JobData = JobData> {
  /** The name of the job handler to use. */
  handlerName: string;
  /** The data for the job to operate on. */
  data?: T;
  /** The number of seconds after which the job should expire. */
  expire?: number;
  /** Whether or not the job should be re-run after completion. */
  isRecurrent?: boolean;
  /** If the job is recurrent, the interval in seconds between runs. */
  recurrenceInterval?: number;
  /** If the job is recurrent, the maximum number of times the job should be re-run. */
  maxRecurrences?: number;
  /** The maximum number of times the job should be retried if it fails. */
  maxRetries?: number;
  /** Initial retries value */
  retries?: number;
  /** Retries delay */
  retriesDelay?: number;
  /** The history of the job */
  history?: JobHistoryInterface;
}

/**
 * A class to represent a job. A job has a handler, some data to operate on, and a status.
 *
 * @export
 * @class Job
 * @template T
 */
export class Job<T extends JobData = JobData> {
  /** The unique identifier of the job */
  id: string;
  /** The name of the handler to be used for this job */
  handlerName: string;
  /** The data to be processed by the job */
  data?: T;
  /** The time in seconds after which the job should be marked as expired */
  expire?: number;
  /** Whether the job should be recurrent or not */
  isRecurrent: boolean;
  /** If the job is recurrent, the interval in seconds between job executions */
  recurrenceInterval: number;
  /** If the job is recurrent, the maximum number of recurrences */
  maxRecurrences: number;
  /** The maximum number of times the job should be retried if it fails */
  maxRetries: number;
  /** The number of times the job has been retried */
  retries: number;
  /** The period of time between retries */
  retriesDelay: number;
  /** The history of the job */
  history: JobHistory;

  /**
   * Creates an instance of Job.
   * @param {JobConfig<T>} config
   * @memberof Job
   */
  constructor(config: JobConfig<T>) {
    this.id = simpleUid();
    this.handlerName = config.handlerName;
    this.data = config.data;
    this.expire = config.expire;
    this.isRecurrent = config.isRecurrent ?? false;
    this.recurrenceInterval = config.recurrenceInterval ?? 0;
    this.maxRecurrences = config.maxRecurrences ?? 0;
    this.maxRetries = config.maxRetries ?? 0;
    this.retries = config.retries ?? 0;
    this.retriesDelay = config.retriesDelay ?? 0;
    this.history = new JobHistory(config.history ?? {});
  }

  /**
   * Setter for `status` property. Adds a new status change to the job history.
   *
   * @memberof Job
   */
  set status(newStatus: JobStatus) {
    this.history.statusChanges.push({
      timestamp: Date.now(),
      status: newStatus,
    });
    logger.trace(`Job #${this.id} status changed to: ${this.status}`);
  }

  /**
   * Getter for `status` property. Returns the most recent status of the job.
   *
   * @memberof Job
   */
  get status() {
    return JobHistory.getStatus(this.history);
  }

  /**
   * Getter for `expired` property. Returns whether the job has expired.
   *
   * @readonly
   * @memberof Job
   */
  get expired() {
    const isExpired =
      this.status === JobStatus.Expired ||
      (this.expire && this.expire * 1000 < Date.now());

    if (isExpired) {
      this.status = JobStatus.Expired;
    }

    return isExpired;
  }

  /**
   * Getter for `executable` property. Returns whether the job can be executed.
   *
   * @readonly
   * @memberof Job
   */
  get executable() {
    return (
      !this.expired &&
      this.status === JobStatus.Pending &&
      ((!this.isRecurrent &&
        (this.maxRetries === 0 ||
          (this.maxRetries > 0 && this.retries < this.maxRetries))) ||
        (this.isRecurrent &&
          (this.maxRecurrences === 0 ||
            (this.maxRecurrences > 0 && this.retries < this.maxRecurrences))))
    );
  }

  /**
   * Returns Job as config object
   *
   * @returns {JobConfig<T>}
   * @memberof Job
   */
  toJSON(): JobConfig<T> {
    return {
      handlerName: this.handlerName,
      data: this.data,
      expire: this.expire,
      isRecurrent: this.isRecurrent,
      recurrenceInterval: this.recurrenceInterval,
      maxRecurrences: this.maxRecurrences,
      maxRetries: this.maxRetries,
      retries: this.retries,
      retriesDelay: this.retriesDelay,
      history: this.history.toJSON(),
    };
  }

  /**
   * Executes the job using the provided handler.
   *
   * @param {JobHandler<T>} handler
   * @returns
   * @memberof Job
   */
  async execute(handler: JobHandler<T>) {
    logger.trace(`Job #${this.id} executed`);
    return Promise.resolve(handler(this.data));
  }
}

/**
 * A class to manage job handlers. Allows for registering and retrieving handlers by name.
 *
 * @export
 * @class JobHandlerRegistry
 */
export class JobHandlerRegistry {
  /** Map to store the handlers */
  handlers: Map<string, JobHandler>;

  /**
   * Creates an instance of JobHandlerRegistry.
   * @memberof JobHandlerRegistry
   */
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Registers a handler for a jobs
   *
   * @param {string} name
   * @param {JobHandler} handler
   * @memberof JobHandlerRegistry
   */
  register(name: string, handler: JobHandler) {
    this.handlers.set(name, handler);
  }

  /**
   * Returns a handler by Id
   *
   * @param {string} name
   * @returns {JobHandler}
   * @memberof JobHandlerRegistry
   */
  getHandler(name: string): JobHandler {
    const handler = this.handlers.get(name);

    if (!handler) {
      throw new Error(`Unable to get job handler: ${name}`);
    }

    return handler;
  }
}

/**
 * Queue class constructor options interface.
 *
 * @export
 * @interface QueueOptions
 */
export interface QueueOptions {
  /** Queue storage object */
  storage?: Storage;
  /** Name of the key that is used for storing jobs Ids */
  idsKeyName?: string;
  /** The maximum number of jobs that can be concurrently active. */
  concurrencyLimit?: number;
}

/**
 * Queue events interface
 */
export interface QueueEvents<T extends JobData = JobData> {
  /**
   * @example
   *
   * ```js
   * queue.addEventListener('status', ({ detail }) => {
   *    // job status changed
   * })
   * ```
   */
  status: CustomEvent<Job<T>>;

  /**
   * @example
   *
   * ```js
   * queue.addEventListener('stop', () => {
   *    // queue stopped
   * })
   * ```
   */
  stop: CustomEvent<void>;
}

/**
 * The Queue class is responsible for managing and executing jobs.
 * It inherits from EventEmitter to allow event-based behavior.
 *
 * @export
 * @class Queue
 * @extends {EventEmitter<QueueEvents>}
 */
export class Queue extends EventEmitter<QueueEvents> {
  /** Queue storage object */
  storage?: Storage;
  /** Name of the key that is used for storing jobs Ids */
  idsKeyName: string;
  /** The maximum number of jobs that can be concurrently active. */
  concurrencyLimit: number;
  /** The list of all jobs in the queue. */
  jobs: Job[];
  /** The registry of job handlers, where handlers are stored by their names. */
  handlers: JobHandlerRegistry;

  /**
   * Creates an instance of Queue.
   * It initializes the jobs list, the handler registry, and sets the concurrency limit.
   * @param {QueueOptions} { concurrencyLimit }
   * @memberof Queue
   */
  constructor({ storage, idsKeyName, concurrencyLimit }: QueueOptions) {
    super();
    this.storage = storage;
    this.idsKeyName = idsKeyName ?? 'jobsIds';
    this.concurrencyLimit = concurrencyLimit ?? 5;
    this.jobs = [];
    this.handlers = new JobHandlerRegistry();
    void this.storageUp();
  }

  /**
   * Restores saved jobs from the storage
   *
   * @protected
   * @returns
   * @memberof Queue
   */
  protected async storageUp() {
    try {
      // Ignore storage features if not set up
      if (!this.storage) {
        return;
      }

      const jobsIds = await this.storage.get<string[]>(this.idsKeyName);

      if (jobsIds) {
        for (const id of jobsIds) {
          try {
            const jobConfig = await this.storage.get<JobConfig>(id);

            if (!jobConfig) {
              throw new Error(`Unable to get job #${id} from storage`);
            }

            // Only Pending jobs must be restored
            if (
              jobConfig.history &&
              JobHistory.getStatus(jobConfig.history) === JobStatus.Pending
            ) {
              this.add(jobConfig);
            }
          } catch (error) {
            logger.error(error);
          }
        }
      } else {
        logger.trace('Jobs Ids not found in the storage');
      }
    } catch (error) {
      logger.error('storageUp error:', error);
    }
  }

  /**
   * Stores all pending jobs to the storage
   *
   * @protected
   * @returns
   * @memberof Queue
   */
  protected async storageDown() {
    try {
      // Ignore storage features if not set up
      if (!this.storage) {
        return;
      }

      const pendingJobs = this.jobs.filter((job) => job.executable);

      const { ids, configs } = pendingJobs.reduce<{
        ids: string[];
        configs: JobConfig[];
      }>(
        (a, v) => {
          a.ids.push(v.id);
          a.configs.push(v.toJSON());
          return a;
        },
        {
          ids: [],
          configs: [],
        },
      );

      const jobsIds = new Set(
        (await this.storage.get<string[]>(this.idsKeyName)) ?? [],
      );

      for (let i = 0; i < ids.length; i++) {
        try {
          jobsIds.add(ids[i]);
          await this.storage.set(ids[i], configs[i]);
        } catch (error) {
          logger.error(`Job #${ids[i]} save error:`, error);
        }
      }

      await this.storage.set(this.idsKeyName, Array.from(jobsIds));
    } catch (error) {
      logger.error('storageDown error:', error);
    }
  }

  /**
   * Updated saved job on storage
   *
   * @protected
   * @param {string} id
   * @param {Job} job
   * @returns
   * @memberof Queue
   */
  protected async storageUpdate(id: string, job: Job) {
    try {
      // Ignore storage features if not set up
      if (!this.storage) {
        return;
      }

      const jobsIds = new Set(
        (await this.storage.get<string[]>(this.idsKeyName)) ?? [],
      );
      jobsIds.add(id);
      await this.storage.set(id, job.toJSON());
      await this.storage.set(this.idsKeyName, Array.from(jobsIds));
    } catch (error) {
      logger.error('storageDown error:', error);
    }
  }

  /**
   * Changes the job status and emits `status` event
   *
   * @private
   * @param {Job} job
   * @param {JobStatus} newStatus
   * @memberof Queue
   */
  private changeJobStatus(job: Job, newStatus: JobStatus) {
    job.status = newStatus;
    this.dispatchEvent(
      new CustomEvent<Job>('status', {
        detail: job,
      }),
    );
    void this.storageUpdate(job.id, job);
  }

  /**
   * Starts processing jobs in the queue.
   * It finds executable jobs and runs them concurrently up to the concurrency limit.
   * If a job fails and it hasn't reached the maximum number of retries, it is set as pending again.
   * If a job is recurrent (i.e., it is supposed to run repeatedly after a certain interval) and
   * the job handler returns true (indicating successful completion of the job), the job is rescheduled.
   *
   * @returns
   * @memberof Queue
   */
  private async start() {
    try {
      const activeJobs = this.jobs.filter(
        (job) => job.status === JobStatus.Started,
      );
      const pendingJobs = this.jobs.filter((job) => job.executable);
      logger.trace(`Active jobs: ${activeJobs.length}`);
      logger.trace(`Pending jobs: ${pendingJobs.length}`);

      const availableSlots = this.concurrencyLimit - activeJobs.length;
      logger.trace(`Available slots: ${availableSlots}`);

      if (availableSlots <= 0 || pendingJobs.length === 0) {
        this.dispatchEvent(new CustomEvent<void>('stop'));
        return; // No available slots or no pending jobs
      }

      // Get the jobs that will be started now
      const jobsToStart = pendingJobs.slice(0, availableSlots);
      logger.trace(
        `Jobs to start: [${jobsToStart.map((j) => j.id).join(', ')}]`,
      );

      // Start all the selected jobs concurrently
      const promises = jobsToStart.map(async (job) => {
        try {
          this.changeJobStatus(job, JobStatus.Started);

          const handler = this.handlers.getHandler(job.handlerName);

          const result = await job.execute(handler);
          logger.trace(`Job #${job.id} execution result: ${String(result)}`);

          if (result && job.isRecurrent) {
            // If the job is recurrent and the handler returned true, reschedule the job
            if (!job.expired) {
              logger.trace(`Job #${job.id} is done but new one is scheduled`);
              this.changeJobStatus(job, JobStatus.Done);
              setTimeout(() => {
                this.add({
                  handlerName: job.handlerName,
                  data: job.data,
                  expire: job.expire,
                  isRecurrent: job.isRecurrent,
                  recurrenceInterval: job.recurrenceInterval,
                  maxRecurrences: job.maxRecurrences,
                  maxRetries: job.maxRetries,
                  retries: job.retries + 1,
                });
              }, job.recurrenceInterval);
            } else {
              logger.trace(`Job #${job.id} is expired`);
              this.changeJobStatus(job, JobStatus.Expired);
            }
          } else {
            logger.trace(`Job #${job.id} is done`);
            this.changeJobStatus(job, JobStatus.Done);
          }
        } catch (error) {
          logger.error(`Job #${job.id} is errored`, error);
          job.history.errors.push(String(error));

          if (job.maxRetries > 0 && job.retries < job.maxRetries) {
            // If the job hasn't reached the maximum number of retries, retry it
            job.retries++;

            if (job.retriesDelay > 0) {
              logger.trace(`Job #${job.id} filed but scheduled for restart`);
              this.changeJobStatus(job, JobStatus.Failed);
              setTimeout(() => {
                this.add({
                  handlerName: job.handlerName,
                  data: job.data,
                  expire: job.expire,
                  maxRetries: job.maxRetries,
                  retries: job.retries + 1,
                });
              }, backoffWithJitter(job.retriesDelay, job.retries, job.retriesDelay * 10));
            } else {
              logger.trace(`Job #${job.id} failed and immediately restarted`);
              this.changeJobStatus(job, JobStatus.Pending);
            }
          } else {
            logger.trace(`Job #${job.id} filed`);
            this.changeJobStatus(job, JobStatus.Failed);
          }
        }
      });

      await Promise.allSettled(promises);

      // After these jobs are done, check if there are any more jobs to process
      logger.trace('Trying to restart queue');
      void this.start();
    } catch (error) {
      logger.error('Queue start failed', error);
    }
  }

  /**
   * Registers a new job handler in the handlers registry.
   *
   * @param {string} name
   * @param {JobHandler} handler
   * @memberof Queue
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerHandler(name: string, handler: JobHandler<any, any>) {
    this.handlers.register(name, handler);
  }

  /**
   * Adds a new job to the queue and starts the queue if it isn't already started.
   *
   * @template T
   * @param {JobConfig<T>} config
   * @returns {string}
   * @memberof Queue
   */
  add<T extends JobData = JobData>(config: JobConfig<T>): string {
    const job = new Job<T>(config);
    this.jobs.push(job);
    logger.trace('Job added:', job);
    void this.storageUpdate(job.id, job);
    void this.start();
    return job.id;
  }

  /**
   * Returns a job from the queue by its ID. Uses local in-memory source
   *
   * @param {string} id
   * @returns {(Job | undefined)} The job if found, otherwise undefined.
   * @memberof Queue
   */
  getLocal<T extends JobData = JobData>(id: string): Job<T> | undefined {
    const localJob = this.jobs.find((job) => job.id === id) as Job<T>;

    if (localJob) {
      return localJob;
    }

    return;
  }

  /**
   * Returns a job config from the queue by its ID. Uses both local and storage search
   *
   * @param {string} id
   * @returns {Promise<JobConfig | undefined>} The job if found, otherwise undefined.
   * @memberof Queue
   */
  async get<T extends JobData = JobData>(
    id: string,
  ): Promise<JobConfig<T> | undefined> {
    const localJob = this.getLocal<T>(id);

    if (localJob) {
      return localJob.toJSON();
    }

    if (!this.storage) {
      return;
    }

    // If job not found locally we will try to find on storage
    return await this.storage.get<JobConfig<T>>(id);
  }

  /**
   * Cancels a job by setting its status to Cancelled.
   *
   * @param {string} id
   * @returns {boolean} true if the job was found and cancelled, false otherwise.
   * @memberof Queue
   */
  cancel(id: string): boolean {
    const job = this.jobs.find((job) => job.id === id);

    if (job) {
      logger.trace(`Job #${id} is cancelled`);
      job.status = JobStatus.Cancelled;
      return true;
    }

    logger.trace(`Job #${id} has not been cancelled`);

    return false;
  }

  /**
   * Deletes a job from the queue.
   *
   * @param {string} id
   * @returns {boolean} true if the job was found and deleted, false otherwise.
   * @memberof Queue
   */
  delete(id: string): boolean {
    const size = this.jobs.length;
    this.jobs = this.jobs.filter((job) => job.id !== id);
    const isDeleted = this.jobs.length < size;

    if (isDeleted) {
      logger.trace(`Job #${id} is deleted`);
    } else {
      logger.trace(`Job #${id} has not been deleted`);
    }

    return isDeleted;
  }

  /**
   * Graceful queue stop
   *
   * @memberof Queue
   */
  async stop() {
    await this.storageDown();
  }
}
