# Availability management

Supplier's services availability management is not a part of the protocol but the information from such systems is the foundation of offers generation. Every offer should represent the availability of service to the buyer.

Here is the list of common use cases of availability management systems that can be implemented in the frame of the protocol:

- availability lookup. Allows to search for available services.
- temporary locking. Allows to lock available service for prevention of double booking.
- booking/selling. Allows to book or sell the service and make it unavailable according to the supplier use case logic.
- change. Allows to change booked service.
- canceling. Allows to cancel already booked service.

The protocol supplier node instances have tools that automate access and communication with external availability management systems. To support earlier mentioned use cases the node configuration has special options to define callback functions.

> This API is experimental and may be changed

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

// You set of custom callbacks
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

Once the properly configured node is started registered API functions become available under the `node.availabilityManager`.
