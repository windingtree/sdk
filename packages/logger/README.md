# @windingtree/sdk-logger

This package is a simple logging utility for Winding Tree SDK based on the [debug](https://www.npmjs.com/package/debug) package. The logger supports multiple logging levels and enables/disables logging for a particular named scope.

## Installation

```bash
pnpm i @windingtree/sdk-logger
```

## Key Concepts

- The logger is enabled for a specific named scope. This allows you to control logging at a granular level and to enable/disable logging for different parts of your application separately.
- The logger supports different log levels. By default, it uses the base log level (equivalent to `debug` in many logging libraries), but it also supports `error` and `trace` levels for logging errors and tracing information, respectively.
- The logger uses string formatters for the log message, similar to `console.log` or `util.format` in Node.js. This makes it easy to interpolate variables into log messages in a safe and consistent way.

## Usage

```typescript
import { createLogger, disable, enable } from '@windingtree/sdk-logger';

const logger = createLogger('my-logger');

logger('Hello, %s!', 'world');
// Output: my-logger Hello, world!

logger.error('An error occurred: %o', new Error('Test error'));
// Output: my-logger:error An error occurred: Error: Test error

logger.trace('Debug trace: %j', { foo: 'bar' });
// Output: my-logger:trace Debug trace: {"foo":"bar"}

disable(); // all loggers are disabled
enable('my-logger'); // logger 'my-logger' is enabled
```

## API

### createLogger(name: string): Logger

Creates a new logger instance with the given name. The returned logger has methods for different log levels.

### enable(name: string): void

Enables logging for the given named scope.

### disable(): string

Disables all logging.

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
