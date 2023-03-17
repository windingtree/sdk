import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { z } from 'zod';
import { Storage } from '../storage/index.js';
import { concurrentQueueJobs, delayQueueJob } from '../constants.js';
import { simpleUid } from '../utils/uid.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queue');

export const QueueOptionsSchema = z
  .object({
    storage: z.instanceof(Storage),
    hashKey: z.string().default('jobKeys').optional(),
    concurrentJobsNumber: z.number().default(concurrentQueueJobs).optional(),
  })
  .strict();

export type QueueOptions = z.infer<typeof QueueOptionsSchema>;

export const JobOptionsSchema = z
  .object({
    repeat: z.number().int().nonnegative().optional(), // Maximum number of repeats when a job is failing
    delay: z.number().int().nonnegative().optional(), // Delay between repeats
  })
  .strict();

export type JobOptions = z.infer<typeof JobOptionsSchema>;

export enum JobStatuses {
  PENDING,
  STARTED,
  DONE,
  FAILED,
}

export const JobStatusSchema = z.nativeEnum(JobStatuses);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobStateSchema = z
  .object({
    status: JobStatusSchema,
    attempts: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative().optional(),
    errors: z.array(
      z.object({
        time: z.number(),
        error: z.string(),
      }),
    ),
  })
  .strict();

export type JobState = z.infer<typeof JobStateSchema>;

export interface Job<JobDataType = unknown> {
  id: string;
  data: JobDataType;
  options: JobOptions;
  state: JobState;
}

export type JobHandler = <JobDataType = unknown>(data: JobDataType) => Promise<void>;

export interface QueueEvents {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('done', ({ detail: jobKey }) => {
   *    // jobKey - finished job key
   * })
   * ```
   */
  done: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('error', ({ detail: jobKey }) => {
   *    // jobKey - errored job key
   * })
   * ```
   */
  error: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('fail', ({ detail: jobKey }) => {
   *    // jobKey - failed job key
   * })
   * ```
   */
  fail: CustomEvent<string>;
}

export class Queue extends EventEmitter<QueueEvents> {
  private keys: Set<string>;
  private jobHandlers: Map<string, JobHandler>;
  private storage: Storage;
  private hashKey: string;
  private concurrentJobsNumber: number;
  private liveJobs: Set<string>;
  private processing: boolean;

  constructor(options: QueueOptions) {
    super();

    options = QueueOptionsSchema.parse(options);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.hashKey = options.hashKey!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.concurrentJobsNumber = options.concurrentJobsNumber!;
    this.storage = options.storage;
    this.keys = new Set<string>();
    this.liveJobs = new Set<string>();
    this.jobHandlers = new Map<string, JobHandler>();
    this.processing = false;
    this._init().catch(logger.error);
  }

  private async _init() {
    const rawJobKeys = await this.storage.get<string>(this.hashKey);

    if (rawJobKeys) {
      const jobKeys = JSON.parse(rawJobKeys) as string[];
      new Set<string>(jobKeys);
    }
  }

  private _saveKeys() {
    this.storage.set(this.hashKey, JSON.stringify(Array.from(this.keys))).catch(logger.error);
  }

  private _addJobId(id: string) {
    this.keys.add(id);
    this._saveKeys();
  }

  private async _pickJobs(): Promise<Job[]> {
    const size = this.concurrentJobsNumber - this.liveJobs.size;
    const jobs: Job[] = [];

    for (const key of this.keys.values()) {
      if (jobs.length === size) {
        break;
      }

      if (!this.liveJobs.has(key)) {
        const job = await this.storage.get<Job>(key);

        if (!job) {
          throw new Error(`Job #${key} not found`);
        }

        if (
          job.state.status !== JobStatuses.PENDING ||
          (job.state.scheduled && job.state.scheduled > Date.now())
        ) {
          continue;
        }

        jobs.push(job);
      }
    }

    return jobs;
  }

  private async _doJob(job: Job): Promise<void> {
    try {
      const callback = this.jobHandlers.get(job.id);

      if (!callback) {
        throw new Error(`Handler for job #${job.id} not found`);
      }

      job.state = JobStateSchema.parse({
        ...job.state,
        status: JobStatuses.STARTED,
      });
      await this.storage.set(job.id, job);

      await Promise.resolve(callback(job.data));

      job.state = JobStateSchema.parse({
        ...job.state,
        status: JobStatuses.DONE,
      });
      await this.storage.set(job.id, job);

      this.liveJobs.delete(job.id);
      this.keys.delete(job.id);
      this._saveKeys();
      this.dispatchEvent(
        new CustomEvent<string>('done', {
          detail: job.id,
        }),
      );
    } catch (error) {
      logger.error(error);

      job.state = JobStateSchema.parse({
        ...job.state,
        errors: [...(job.state.errors ?? []), (error as Error).stack],
      });

      if (job.options.repeat && job.options.repeat > 0 && job.state.attempts < job.options.repeat) {
        job.state = JobStateSchema.parse({
          ...job.state,
          status: JobStatuses.PENDING,
          attempts: job.state.attempts + 1,
          scheduled: Date.now() + (job.options.delay ?? delayQueueJob),
        });
        await this.storage.set(job.id, job);
        this.liveJobs.delete(job.id);
        this.dispatchEvent(
          new CustomEvent<string>('error', {
            detail: job.id,
          }),
        );
      } else {
        job.state = JobStateSchema.parse({
          ...job.state,
          status: JobStatuses.FAILED,
        });
        await this.storage.set(job.id, job);
        this.liveJobs.delete(job.id);
        this.keys.delete(job.id);
        this.dispatchEvent(
          new CustomEvent<string>('fail', {
            detail: job.id,
          }),
        );
      }
    }

    this._process().catch(logger.error);
  }

  private async _process() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const jobs = await this._pickJobs();

    if (jobs.length > 0) {
      for (const job of jobs) {
        this._doJob(job).catch(logger.error);
      }
    }

    this.processing = false;
  }

  addJobHandler(name: string, callback: JobHandler) {
    this.jobHandlers.set(name, callback);
  }

  addJob<JobDataType = unknown>(name: string, data: JobDataType, options?: JobOptions) {
    if (!this.jobHandlers.has(name)) {
      throw new Error(`Job handler with name #${name} not registered yet`);
    }

    const jobId = simpleUid();
    this._addJobId(jobId);
    this.storage
      .set<Job>(jobId, {
        id: jobId,
        data,
        options: JobOptionsSchema.parse(options ?? {}),
        state: JobStateSchema.parse({
          status: JobStatuses.PENDING,
          attempts: 1,
          errors: [],
        }),
      })
      .then(this._process.bind(this))
      .catch(logger.error);
  }

  async getJob<JobDtaType>(key: string): Promise<Job<JobDtaType>> {
    const job = await this.storage.get<Job<JobDtaType>>(key);

    if (!job) {
      throw new Error(`Job $${key} not found`);
    }

    return job;
  }
}
