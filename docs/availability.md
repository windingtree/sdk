# Availability Management

> **Note**: This functionality is not implemented yet. Use these guidelines to review potential future features.

Supplier's services availability management is not a part of the protocol, but the information from such systems is the foundation of offer generation. Every offer should represent the availability of a service to the buyer.

The following are common use cases of availability management systems that can be implemented within the protocol:

- **Availability Lookup**: Allows searching for available services.
- **Temporary Locking**: Allows locking an available service to prevent double booking.
- **Booking/Selling**: Allows booking or selling the service and making it unavailable according to the supplier's use case logic.
- **Change**: Allows changing a booked service.
- **Canceling**: Allows canceling an already booked service.

The protocol's supplier node instances have tools that automate access and communication with external availability management systems. To support the aforementioned use cases, the node configuration has special options to define callback functions.

```typescript
import { GenericQuery, GenericAvailabilityResponse, GenericAvailabilityLockQuery, GenericAvailabilityBookQuery, GenericAvailabilityCancelQuery, NodeOptions, createNode } from '@windingtree/sdk';

interface AvailabilityManagerApiOptions<RequestQuery extends GenericQuery, AvailabilityResponse extends GenericAvailabilityResponse, LockQuery extends GenericAvailabilityLockQuery, BookQuery extends GenericAvailabilityBookQuery, CancelQuery extends GenericAvailabilityCancelQuery> {
  async lookup(query: RequestQuery): Promise<AvailabilityResponse>;
  async lock(query: LockQuery): Promise<boolean>;
  async unlock(query: LockQuery): Promise<boolean>;
  async book(query: BookQuery): Promise<boolean>;
  async change(query: BookQuery): Promise<boolean>;
  async cancel(query: CancelQuery): Promise<boolean>;
}

interface AvailabilityManagerOptions {
  lockPeriod: number; // temporary locking time in seconds
  api: AvailabilityManagerApiOptions;
}

// Your set of custom callbacks
const lookup = async (query: RequestQuery): Promise<AvailabilityResponse> => {/**/};
const lock = async (query: LockQuery): Promise<boolean> => {/**/};
const unlock = async (query: LockQuery): Promise<boolean> => {/**/};
const book = async (query: BookQuery): Promise<boolean> => {/**/};
const change = async (query: BookQuery): Promise<boolean> => {/**/};
const cancel = async (query: CancelQuery): Promise<boolean => {/**/};

// The supplier node configuration
const options: NodeOptions = {
  /* other options */
  availabilityManager: {
    lockPeriod: 60 * 30, // 30 min
    api: {
      lock,
      unlock,
      book,
      change,
      cancel,
    }
  },
};

const node = createNode(options);
```

Once the properly configured node is started, the registered API functions become available under `node.availabilityManager`. These API functions can then be used to manage the availability of services and support various availability-related use cases within the WindingTree market protocol.
