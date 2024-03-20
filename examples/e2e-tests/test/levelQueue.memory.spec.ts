import { describe, expect, it } from 'vitest';
import { JobHandler, Queue } from '@windingtree/sdk-queue';
import { DateTime } from 'luxon';
import { GenericStorageOptions } from '@windingtree/sdk-storage';
import { createInitializer } from '@windingtree/sdk-storage/level';

describe('Level Queue Test', () => {
  const createJobHandler =
    <JobData = unknown, HandlerOptions = unknown>(
      handler: JobHandler<JobData, HandlerOptions>,
    ) =>
    (options: HandlerOptions = {} as HandlerOptions) =>
    (data: JobData) =>
      handler(data, options);

  it('Initializer queue jobs test', async () => {
    const options: GenericStorageOptions = { scope: 'queueTestInitializer' };
    const initializer = createInitializer(options);
    const initializedStorage = await initializer();

    let queue = new Queue({
      storage: initializedStorage,
      idsKeyName: 'jobsIds',
      concurrencyLimit: 3,
    });

    const idsSet: Set<number> = new Set();
    let hasDoubleJobs = false;
    const testHandler = createJobHandler<{ id: number }>(async (data) => {
      if (data?.id) {
        const { id } = data;

        if (idsSet.has(id)) {
          hasDoubleJobs = true;
        }

        idsSet.add(data?.id);
      }

      return Promise.resolve(false);
    });

    queue.registerHandler('test', testHandler());

    const id = Math.floor(Math.random() * 100);
    const timeoutSeconds = 3;

    DateTime.fromJSDate(new Date()).plus({ minutes: 5 }).toSeconds();

    const jobId = queue.add({
      handlerName: 'test',
      data: { id },
      maxRetries: 1,
      expire: DateTime.fromJSDate(new Date()).plus({ minutes: 5 }).toSeconds(),
      scheduledTime: DateTime.fromJSDate(new Date())
        .plus({ seconds: timeoutSeconds })
        .toMillis(),
    });

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 500);
    });

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), (timeoutSeconds + 1) * 1000);
    });

    await queue.stop();

    queue = new Queue({
      storage: initializedStorage,
      idsKeyName: 'jobsIds',
      concurrencyLimit: 3,
    });

    await new Promise<void>((resolve) => {
      return setTimeout(() => resolve(), 1000);
    });

    const data = (await queue.get(jobId))?.data;

    expect((data as { id: number }).id).toBe(id);
    expect(hasDoubleJobs).toBe(false);
  });
});
