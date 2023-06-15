import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';

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
export type JobData = object;

/**
 * Interface for the function that a job runs.
 */
export interface JobHandler<T extends JobData = JobData> {
  (data?: T): Promise<boolean>;
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
}

/**
 * A class to manage the history of a job. This includes status changes and errors.
 *
 * @export
 * @class JobHistory
 */
export class JobHistory {
  /** A history of all status changes for the job. */
  statusChanges: { timestamp: Date; status: JobStatus }[];
  /** A history of all errors for the job. */
  errors: Error[];

  constructor() {
    this.statusChanges = [];
    this.errors = [];
  }
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
  /** The history of the job */
  history: JobHistory;

  /**
   * Creates an instance of Job.
   * @param {JobConfig<T>} config
   * @memberof Job
   */
  constructor(config: JobConfig<T>) {
    this.id = Date.now().toString();
    this.history = new JobHistory();
    this.handlerName = config.handlerName;
    this.data = config.data;
    this.expire = config.expire;
    this.status = JobStatus.Pending;
    this.isRecurrent = config.isRecurrent ?? false;
    this.recurrenceInterval = config.recurrenceInterval ?? 0;
    this.maxRecurrences = config.maxRecurrences ?? 0;
    this.maxRetries = config.maxRetries ?? 0;
    this.retries = config.retries ?? 0;
  }

  /**
   * Setter for `status` property. Adds a new status change to the job history.
   *
   * @memberof Job
   */
  set status(newStatus: JobStatus) {
    this.history.statusChanges.push({
      timestamp: new Date(),
      status: newStatus,
    });
  }

  /**
   * Getter for `status` property. Returns the most recent status of the job.
   *
   * @memberof Job
   */
  get status() {
    return this.history.statusChanges[this.history.statusChanges.length - 1]
      .status;
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
   * Executes the job using the provided handler.
   *
   * @param {JobHandler<T>} handler
   * @returns
   * @memberof Job
   */
  async execute(handler: JobHandler<T>) {
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
  constructor({ concurrencyLimit }: QueueOptions) {
    super();
    this.concurrencyLimit = concurrencyLimit ?? 5;
    this.jobs = [];
    this.handlers = new JobHandlerRegistry();
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

      const availableSlots = this.concurrencyLimit - activeJobs.length;

      if (availableSlots <= 0 || pendingJobs.length === 0) {
        this.dispatchEvent(new CustomEvent<void>('stop'));
        return; // No available slots or no pending jobs
      }

      // Get the jobs that will be started now
      const jobsToStart = pendingJobs.slice(0, availableSlots);

      // Start all the selected jobs concurrently
      const promises = jobsToStart.map(async (job) => {
        try {
          this.changeJobStatus(job, JobStatus.Started);

          const handler = this.handlers.getHandler(job.handlerName);

          const shouldRecur = await job.execute(handler);

          if (shouldRecur && job.isRecurrent) {
            // If the job is recurrent and the handler returned true, reschedule the job
            if (!job.expired) {
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
              this.changeJobStatus(job, JobStatus.Expired);
            }
          } else {
            this.changeJobStatus(job, JobStatus.Done);
          }
        } catch (error) {
          job.history.errors.push(error as Error);

          if (job.maxRetries > 0 && job.retries < job.maxRetries) {
            // If the job hasn't reached the maximum number of retries, retry it
            job.retries++;
            this.changeJobStatus(job, JobStatus.Pending);
          } else {
            this.changeJobStatus(job, JobStatus.Failed);
          }
        }
      });

      await Promise.allSettled(promises);

      // After these jobs are done, check if there are any more jobs to process
      void this.start();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Registers a new job handler in the handlers registry.
   *
   * @param {string} name
   * @param {JobHandler} handler
   * @memberof Queue
   */
  registerHandler(name: string, handler: JobHandler) {
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
    void this.start();
    return job.id;
  }

  /**
   * Returns a job from the queue by its ID.
   *
   * @param {string} id
   * @returns {(Job | undefined)} The job if found, otherwise undefined.
   * @memberof Queue
   */
  get(id: string): Job | undefined {
    return this.jobs.find((job) => job.id === id);
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
      job.status = JobStatus.Cancelled;
      return true;
    }

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
    return this.jobs.length < size;
  }
}
