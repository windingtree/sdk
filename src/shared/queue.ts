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

export enum JobStates {
  PENDING,
  STARTED,
  DONE,
  FAILED,
}

export const JobStateSchema = z.nativeEnum(JobStates);

export type JobState = z.infer<typeof JobStateSchema>;

export const JobResultSchema = z
  .object({
    state: JobStateSchema,
    attempts: z.number().int().nonnegative(),
    errors: z.array(
      z.object({
        time: z.number(),
        error: z.string(),
      }),
    ),
  })
  .strict();

export type JobResult = z.infer<typeof JobResultSchema>;

export interface Job<JobDataType = unknown> {
  data: JobDataType;
  options: JobOptions;
  result: JobResult;
}

export type JobHandler = <JobDataType = unknown>(data: JobDataType) => Promise<void>;

export interface QueueEvents {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('start', () => {
   *    // ... started
   * })
   * ```
   */
  start: CustomEvent<void>;

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
  started: boolean;
  private keys: Set<string>;
  private jobHandlers: Map<string, JobHandler>;
  private storage: Storage;
  private hashKey: string;
  private concurrentJobsNumber: number;
  private liveJobs: Set<string>;

  constructor(options: QueueOptions) {
    super();

    options = QueueOptionsSchema.parse(options);

    this.started = false;
    this.storage = options.storage;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.hashKey = options.hashKey!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (this.concurrentJobsNumber = options.concurrentJobsNumber!), (this.keys = new Set<string>());
    this.liveJobs = new Set<string>();
    this.jobHandlers = new Map<string, JobHandler>();
  }

  private _saveKeys() {
    this.storage.set(this.hashKey, JSON.stringify(Array.from(this.keys))).catch(logger.error);
  }

  private _saveJobId(id: string) {
    this.keys.add(id);
    this._saveKeys();
  }

  private _pickKeys(): string[] {
    // @todo Review this calculation again
    const size = this.concurrentJobsNumber - this.liveJobs.size;
    let cursor = 0;
    const chosenKeys = [];

    for (const key of this.keys.values()) {
      if (cursor >= size) {
        break;
      }
      if (!this.liveJobs.has(key)) {
        chosenKeys.push(key);
        cursor++;
      }
    }

    return chosenKeys;
  }

  private _process() {
    const jobKeys = this._pickKeys();

    if (jobKeys.length > 0) {
      for (const key of jobKeys) {
        try {
          const handler = async () => {
            const callback = this.jobHandlers.get(key);

            if (!callback) {
              throw new Error(`Unable to find handler for job #${key}`);
            }

            const job = await this.getJob<Job>(key);

            job.result = JobResultSchema.parse({
              ...job.result,
              state: JobStates.STARTED,
            });
            await this.storage.set(key, job);

            await Promise.resolve(callback(job.data));

            job.result = JobResultSchema.parse({
              ...job.result,
              state: JobStates.DONE,
            });
            await this.storage.set(key, job);

            this.liveJobs.delete(key);
            this.keys.delete(key);
            this._saveKeys();
            this.dispatchEvent(
              new CustomEvent<string>('done', {
                detail: key,
              }),
            );
          };

          handler()
            .catch(async (error) => {
              logger.error(error);

              const job = await this.getJob<Job>(key);

              job.result = JobResultSchema.parse({
                ...job.result,
                errors: [...(job.result.errors ?? []), (error as Error).stack],
              });

              if (
                job.options.repeat &&
                job.options.repeat > 0 &&
                job.result.attempts < job.options.repeat
              ) {
                job.result.state = JobStates.PENDING;
                job.result.attempts++;
                await this.storage.set(key, job);
                setTimeout(() => {
                  this.liveJobs.delete(key);
                  this._process();
                }, job.options.delay ?? delayQueueJob);
                this.dispatchEvent(
                  new CustomEvent<string>('error', {
                    detail: key,
                  }),
                );
              } else {
                this.liveJobs.delete(key);
                this.keys.delete(key);
                job.result.state = JobStates.FAILED;
                await this.storage.set(key, job);
                this.dispatchEvent(
                  new CustomEvent<string>('fail', {
                    detail: key,
                  }),
                );
              }
            })
            .catch(logger.error)
            .finally(this._process.bind(this));
        } catch (error) {
          logger.error(error);
        }
      }
    }
  }

  async start() {
    const rawJobKeys = await this.storage.get<string>(this.hashKey);

    if (rawJobKeys) {
      const jobKeys = JSON.parse(rawJobKeys) as string[];
      new Set<string>(jobKeys);
    }

    this.started = true;
    this.dispatchEvent(new CustomEvent<void>('start'));
  }

  addJobHandler(name: string, callback: JobHandler) {
    this.jobHandlers.set(name, callback);
  }

  addJob<JobDataType = unknown>(name: string, data: JobDataType, options?: JobOptions) {
    if (!this.jobHandlers.has(name)) {
      throw new Error(`Job handler with name #${name} not registered yet`);
    }

    const jobId = simpleUid();
    this._saveJobId(jobId);
    this.storage
      .set<Job>(jobId, {
        data,
        options: JobOptionsSchema.parse(options ?? {}),
        result: {
          state: JobStates.PENDING,
          attempts: 1,
          errors: [],
        },
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
