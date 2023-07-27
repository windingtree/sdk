import { useCallback, useState } from 'react';
import { DateTime } from 'luxon';
import { Hash } from 'viem';
import { stringify } from 'superjson';
import { useConfig, useNode } from '@windingtree/sdk-react/providers';
import {
  DealRecord,
  DealStatus,
  GenericOfferOptions,
  GenericQuery,
} from '@windingtree/sdk-types';
import { formatBalance } from '@windingtree/sdk-react/utils';
import { DealCheckInOut } from './DealCheckInOut.js';

/**
 * Deals table
 */
export const DealSeek = () => {
  const { isAuth } = useConfig();
  const { node } = useNode();
  const [offerId, setOfferId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [action, setAction] = useState<number | undefined>();
  const [deal, setDeal] = useState<
    DealRecord<GenericQuery, GenericOfferOptions> | undefined
  >();
  const [error, setError] = useState<string | undefined>();

  const getDeal = useCallback(
    async (id: Hash) => {
      try {
        setError(undefined);
        setLoading(false);
        setAction(undefined);

        if (!node) {
          return;
        }

        setLoading(true);
        const record = await node.deals.seek.mutate({
          id,
        });
        console.log('Deal:', record);
        setDeal(record);
        setLoading(false);
      } catch (error) {
        console.log(error);
        setError((error as Error).message || 'Unknown login error');
        setLoading(false);
      }
    },
    [node],
  );

  if (!isAuth) {
    return null;
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <div>
          <strong>Offer Id:</strong>
        </div>
        <div>
          <input
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      <div
        style={{ marginTop: 5, display: 'flex', flexDirection: 'row', gap: 10 }}
      >
        <div>
          <button onClick={() => getDeal(offerId as Hash)} disabled={loading}>
            Get deal{loading ? '...' : ''}
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              setOfferId('');
              setDeal(undefined);
            }}
            disabled={loading || !offerId}
          >
            Clear
          </button>
        </div>
      </div>
      {deal && (
        <>
          <div
            style={{
              marginTop: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div>
              <strong>Offer id</strong>: {deal.offer.payload.id}
            </div>
            <div>
              <strong>Created</strong>:{' '}
              {DateTime.fromSeconds(Number(deal.created)).toLocaleString(
                DateTime.DATETIME_SHORT,
              )}{' '}
              ({DateTime.fromSeconds(Number(deal.created)).toRelative()})
            </div>
            <div>
              <strong>Check In</strong>:{' '}
              {DateTime.fromSeconds(
                Number(deal.offer.payload.checkIn),
              ).toLocaleString(DateTime.DATETIME_SHORT)}{' '}
              (
              {DateTime.fromSeconds(
                Number(deal.offer.payload.checkIn),
              ).toRelative()}
              )
            </div>
            <div>
              <strong>Check Out</strong>:{' '}
              {DateTime.fromSeconds(
                Number(deal.offer.payload.checkOut),
              ).toLocaleString(DateTime.DATETIME_SHORT)}{' '}
              (
              {DateTime.fromSeconds(
                Number(deal.offer.payload.checkOut),
              ).toRelative()}
              )
            </div>
            <div>
              <strong>Offer options:</strong>: {stringify(deal.offer.options)}
            </div>
            <div>
              <strong>Buyer</strong>: {deal.buyer}
            </div>
            <div>
              <strong>Price</strong>: {formatBalance(deal.price, 4)}
            </div>
            <div>
              <strong>Asset</strong>: {deal.asset}
            </div>
            <div>
              <strong>Transferable</strong>:{' '}
              {deal.offer.payload.transferable ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Status</strong>: {DealStatus[deal.status]}
            </div>
          </div>

          <div style={{ marginTop: 20, marginBottom: 5 }}>
            <div>
              <h3>Select an action:</h3>
            </div>
            <div>
              <input
                onChange={() => setAction(0)}
                type="radio"
                id="checkin"
                name="checkin"
                value="checkin"
                checked={action === 0}
              />
              <label htmlFor="register">Check In</label>
            </div>
            <div>
              <input
                onChange={() => setAction(1)}
                type="radio"
                id="checkout"
                name="checkout"
                value="checkout"
                checked={action === 1}
              />
              <label htmlFor="login">Check Out</label>
            </div>
          </div>

          <DealCheckInOut action={action} deal={deal} />
        </>
      )}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
