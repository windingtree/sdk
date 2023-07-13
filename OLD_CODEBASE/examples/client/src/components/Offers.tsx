import { useState, useEffect } from 'react';
import { stringify } from 'viem';
import { utils } from '../../../../src/index.js'; // @windingtree/sdk
import { OfferData } from '../../../../src/shared/types.js';
import { RequestQuery, OfferOptions } from '../../../shared/index.js';
import { centerEllipsis } from '../../../react-libs/src/utils/index.js';

interface OffersProps {
  offers?: OfferData<RequestQuery, OfferOptions>[];
  onAccept(offers: OfferData<RequestQuery, OfferOptions>): void;
  onClose: () => void;
}

/**
 * Received offers table
 */
export const Offers = ({ offers, onAccept, onClose }: OffersProps) => {
  const [offerStates, setOfferStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (offers && offers.length > 0) {
      const expireHandler = () => {
        const newOfferStates: Record<string, boolean> = {};
        offers.forEach((offer) => {
          newOfferStates[offer.id] = utils.isExpired(offer.expire);
        });
        setOfferStates(newOfferStates);
      };

      const interval = setInterval(expireHandler, 1000);
      expireHandler();

      return () => clearInterval(interval);
    }
  }, [offers]);

  if (!offers || offers.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
      >
        <div style={{ flex: 1 }}>
          <h3>Offers</h3>
        </div>
        <div style={{ flex: 1 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <td>Id</td>
            <td>Data</td>
            <td>Expired</td>
            <td>Action</td>
          </tr>
        </thead>
        <tbody>
          {offers.map((o, index) => (
            <tr key={index}>
              <td>{centerEllipsis(o.id)}</td>
              <td>{stringify(o.options)}</td>
              <td>{offerStates[o.id] ? '✅' : 'no'}</td>
              <td>
                {!offerStates[o.id] ? (
                  <button onClick={() => onAccept(o)}>Accept</button>
                ) : (
                  ''
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
