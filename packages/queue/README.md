# @windingtree/sdk-queue

This package provides a task queue system designed to manage jobs that need to be executed in an asynchronous, distributed manner.

## Installation

```bash
pnpm i @windingtree/sdk-queue
```

## Key concepts

This library introduces several classes:

1. `Job`: This class represents a job, which is a unit of work that the queue needs to execute. A job has properties like `id`, `handlerName`, `data`, `status`, `isRecurrent`, `recurrenceInterval`, `maxRecurrences`, and `retries`.

2. `JobHandler`: This is a function that a job runs when it's its turn to be executed by the queue.

3. `JobHandlerRegistry`: This class manages job handlers. It allows for registering and retrieving handlers by name.

4. `Queue`: This is the main class of this package. It's responsible for managing and executing jobs.

5. `JobStatus`: An enum representing the different states a job can be in.

## Usage

```typescript
import { Queue, JobConfig } from '@windingtree/sdk-queue';

// Create a new queue
const queue = new Queue({ concurrencyLimit: 5 });

// Register a job handler
queue.registerHandler('myHandler', async (data) => {
  // Process data here
  console.log(data);
  return true;
});

// Create a job config
const jobConfig: JobConfig = {
  handlerName: 'myHandler',
  data: { key: 'value' },
  maxRetries: 3,
};

// Add a job to the queue
const jobId = queue.add(jobConfig);

// You can also get a job
const job = queue.get(jobId);

// Or cancel a job
queue.cancel(jobId);

// Or delete a job
queue.delete(jobId);
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
