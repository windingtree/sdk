# @windingtree/sdk-test-utils

The `@windingtree/sdk-test-utils` package is a utility package designed for testing purposes within the Winding Tree SDK. It extends the capabilities of the [vitest](https://github.com/vitest-dev/vitest) test runner with a custom function for validating deep equality of objects, more features will be added later.

## Installation

```bash
pnpm i @windingtree/sdk-test-utils
```

## Key concepts

- `expectDeepEqual`: This function is used to validate the deep equality of two objects. It compares two objects recursively and expects every single key in the first object to be equal to the corresponding key in the second object.

## Usage

Here is a simplified example of how you can use the `@windingtree/sdk-test-utils` package:

```typescript
import { test, expectDeepEqual } from '@windingtree/sdk-test-utils';

test('deep equality of objects', () => {
  const obj1 = {
    key1: 'value1',
    key2: {
      nestedKey1: 'nestedValue1',
      nestedKey2: 'nestedValue2',
    },
  };

  const obj2 = {
    key1: 'value1',
    key2: {
      nestedKey1: 'nestedValue1',
      nestedKey2: 'nestedValue2',
    },
  };

  expectDeepEqual(obj1, obj2);
});
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
