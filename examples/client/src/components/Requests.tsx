import {
  RequestRecord,
  utils,
} from '../../../../src/index.js'; // @windingtree/sdk
import { OfferData } from '../../../../src/shared/types.js';
import { RequestQuery, OfferOptions } from '../../../shared/index.js';
import { centerEllipsis } from '../utils.js';

export type RequestsRegistryRecord = Required<RequestRecord<RequestQuery, OfferOptions>>;

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
export const Requests = ({ requests, subscribed, onClear, onCancel, onOffers }: RequestsProps) => {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
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
              <td>{utils.isExpired(r.data.expire) || r.cancelled ? '✅' : 'no'}</td>
              <td>
                {r.offers.length === 0 ? 0 : ''}
                {r.offers.length > 0 && (
                  <button onClick={() => onOffers(r.offers)}>{r.offers.length}</button>
                )}
              </td>
              <td>
                {!r.cancelled && !utils.isExpired(r.data.expire) ? (
                  <button
                    onClick={() => {
                      onCancel(r.data.id);
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  'cancelled'
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
