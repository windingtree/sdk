import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { stringify } from 'superjson';
import { useConfig, useNode } from '@windingtree/sdk-react/providers';
import {
  DealRecord,
  DealStatus,
  GenericOfferOptions,
  GenericQuery,
} from '@windingtree/sdk-types';
import { centerEllipsis, formatBalance } from '@windingtree/sdk-react/utils';

/**
 * Deals table
 */
export const Deals = () => {
  const { isAuth } = useConfig();
  const { node } = useNode();
  const [dealStates, setDealStates] = useState<Record<string, DealStatus>>({});
  const [deals, setDeals] = useState<
    DealRecord<GenericQuery, GenericOfferOptions>[]
  >([]);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const getDeals = useCallback(async () => {
    setError(undefined);
    setMessage(undefined);

    if (!node) {
      return;
    }
    const records = await node.deals.getAll.query({});
    console.log('Deals:', records);
    setDeals(records);
  }, [node]);

  useEffect(() => {
    if (deals && deals.length > 0) {
      const newDealStates: Record<string, DealStatus> = {};
      deals.forEach((d) => {
        newDealStates[d.offer.id] = d.status;
      });
      setDealStates(newDealStates);
    }
  }, [deals]);

  if (!isAuth) {
    return null;
  }

  return (
    <div>
      <div>
        <button onClick={getDeals}>Load deals</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <table border={1} cellPadding={5}>
          <thead>
            <tr>
              <td>Offer Id</td>
              <td>Created</td>
              <td>Options</td>
              <td>Buyer</td>
              <td>Price</td>
              <td>Status</td>
              <td>Action</td>
            </tr>
          </thead>
          <tbody>
            {deals.map((d, index) => (
              <tr key={index}>
                <td>{centerEllipsis(d.offer.payload.id)}</td>
                <td>{DateTime.fromSeconds(Number(d.created)).toISODate()}</td>
                <td>{stringify(d.offer.options)}</td>
                <td>{centerEllipsis(d.buyer)}</td>
                <td>{formatBalance(d.price, 4)}</td>
                <td
                  style={{
                    color: dealStates[d.offer.id] === 1 ? 'green' : 'red',
                  }}
                >
                  {DealStatus[dealStates[d.offer.id]]}
                </td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
