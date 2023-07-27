# @windingtree/sdk-db

This package provides convenient abstraction and interaction with storage for the Winding Tree SDK. It includes functionalities for managing users and deals data in a secure and effective way. The package uses bcrypt hashing for password management and offers utilities for pagination.

## Installation

```bash
pnpm i @windingtree/sdk-db
```

## Key Concepts

- `UsersDb`: Provides methods for adding, getting, setting, and deleting users in the database. It also includes a method for comparing passwords.
- `DealsDb`: Provides methods for adding, getting, and retrieving all deals in the database.
- Both `UsersDb` and `DealsDb` require a storage instance and prefix for their constructor, which are used to manage their data in a common storage solution.
- Passwords in `UsersDb` are hashed using `bcrypt-ts`. This ensures that even if the user data were compromised, the passwords would still be safe.
- Pagination is supported in `DealsDb` for fetching multiple deals.

## Usage

```typescript
import { UsersDb, DealsDb } from '@windingtree/sdk-db';
import { memoryStorage } from '@windingtree/sdk-storage'; // localStorage, etc

const storageInitializer =
  memoryStorage.createInitializer(/* storage configuration */);
const prefix = 'winding_tree';

// Instantiate UsersDb
const usersDb = new UsersDb({ storage: await storageInitializer(), prefix });

// Use methods to interact with the users database
usersDb.add(/* parameters */);
usersDb.get(/* parameters */);
// and other methods...

// Instantiate DealsDb
const dealsDb = new DealsDb({ storage: await storageInitializer(), prefix });

// Use methods to interact with the deals database
dealsDb.set(/* parameters */);
dealsDb.get(/* parameters */);
dealsDb.getAll(/* parameters */);
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
