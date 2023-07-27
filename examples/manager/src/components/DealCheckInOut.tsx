import { useCallback, useState, useMemo, useEffect } from 'react';
import { Hash } from 'viem';
import {
  DealRecord,
  DealStatus,
  GenericOfferOptions,
  GenericQuery,
} from '@windingtree/sdk-types';
import { useConfig, useNode } from '@windingtree/sdk-react/providers';

export interface DealCheckInProps {
  action?: number;
  deal?: DealRecord<GenericQuery, GenericOfferOptions>;
}

export const DealCheckInOut = ({ action, deal }: DealCheckInProps) => {
  const { isAuth } = useConfig();
  const { node } = useNode();
  const [userSign, setUserSign] = useState<Hash | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setError(undefined);
    setMessage(undefined);
    setLoading(false);
  }, [action]);

  const actionAllowed = useMemo(() => {
    return (
      deal &&
      ((action === 0 && deal.status !== DealStatus.CheckedIn) ||
        (action === 1 && deal.status !== DealStatus.CheckedOut))
    );
  }, [deal, action]);

  const actionName = useMemo(() => {
    switch (action) {
      case 0:
        return 'check in';
      case 1:
        return 'check out';
      default:
        return 'unknown';
    }
  }, [action]);

  const isBeforeCheckInTime = useMemo(() => {
    if (!deal) {
      return false;
    }

    return Date.now() / 1000 > Number(deal.offer.payload.checkIn);
  }, [deal]);

  const handleCheckInOut = useCallback(async () => {
    try {
      setError(undefined);
      setMessage(undefined);
      setLoading(false);

      if (!node || !deal) {
        return;
      }

      let actionFn: 'checkIn' | 'checkOut';
      let resMessage: string;

      switch (action) {
        case 0:
          actionFn = 'checkIn';
          resMessage = 'The deal has been successfully checked in';
          break;
        case 1:
          actionFn = 'checkOut';
          resMessage = 'The deal has been successfully checked out';
          break;
        default:
          throw new Error('Unknown deal action');
      }

      setLoading(true);
      await node.deals[actionFn].mutate({
        id: deal.offer.id,
        sign: userSign,
      });
      setMessage(resMessage);
      setLoading(false);
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown check in error');
      setLoading(false);
    }
  }, [node, deal, userSign, action]);

  if (action === undefined || !deal || !node || !isAuth) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      {action === 0 && deal.status === DealStatus.CheckedIn && (
        <div style={{ marginTop: 20 }}>🚨 Already checked in</div>
      )}

      {action === 1 && deal.status === DealStatus.CheckedOut && (
        <div style={{ marginTop: 20 }}>🚨 Already checked out</div>
      )}

      {actionAllowed && (
        <>
          <h2>Deal {actionName}:</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {action !== 1 && (
              <>
                <div>
                  <strong>
                    User's signature
                    {isBeforeCheckInTime
                      ? ' (optional after check in time)'
                      : ''}
                    :
                  </strong>
                </div>
                <div>
                  <input
                    value={userSign || ''}
                    onChange={(e) => setUserSign(e.target.value as Hash)}
                    disabled={loading}
                  />
                </div>
              </>
            )}
            <div>
              <button onClick={() => handleCheckInOut()} disabled={loading}>
                Start{loading ? '...' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      {message && <div style={{ marginTop: 20 }}>✅ {message}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </div>
  );
};
