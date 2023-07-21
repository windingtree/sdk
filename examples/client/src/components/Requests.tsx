import { isExpired } from '@windingtree/sdk-utils';
import { ClientRequestRecord } from '@windingtree/sdk-client';
import { OfferData } from '@windingtree/sdk-types';
import { RequestQuery, OfferOptions } from 'wtmp-protocol-examples-shared-files';
import { centerEllipsis } from '@windingtree/sdk-react/utils';

export type RequestsRegistryRecord = Required<
  ClientRequestRecord<RequestQuery, OfferOptions>
>;

export interface RequestsProps {
  requests: RequestsRegistryRecord[];
  subscribed?: (id: string) => boolean;
  onClear(): void;
  onCancel(id: string): void;
  onOffers(offers: OfferData<RequestQuery, OfferOptions>[]): void;
}

/**
 * Published requests table
 */
export const Requests = ({
  requests,
  subscribed,
  onClear,
  onCancel,
  onOffers,
}: RequestsProps) => {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <td>Topic</td>
            <td>Id</td>
            <td>Query</td>
            <td>Subscribed</td>
            <td>Expired</td>
            <td>Offers</td>
            <td>Cancel</td>
          </tr>
        </thead>
        <tbody>
          {requests.map((r, index) => (
            <tr key={index}>
              <td>{r.data.topic}</td>
              <td>{centerEllipsis(r.data.id)}</td>
              <td>{JSON.stringify(r.data.query)}</td>
              <td>{subscribed && subscribed(r.data.id) ? '✅' : 'no'}</td>
              <td>{isExpired(r.data.expire) ? '✅' : 'no'}</td>
              <td>
                {r.offers.length === 0 ? 0 : ''}
                {r.offers.length > 0 && (
                  <button onClick={() => onOffers(r.offers)}>
                    {r.offers.length}
                  </button>
                )}
              </td>
              <td>
                {!r.subscribed && !isExpired(r.data.expire) && (
                  <button
                    onClick={() => {
                      onCancel(r.data.id);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            onClear();
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};
