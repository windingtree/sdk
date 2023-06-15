import { useState, useCallback, useEffect } from 'react';
import { Hash, stringify } from 'viem';
import { ClientDealsManager } from '../../../../src/index.js'; // @windingtree/sdk
import { OfferData } from '../../../../src/shared/types.js';
import { RequestQuery, OfferOptions } from '../../../shared/index.js';
import {
  ZeroHash,
  centerEllipsis,
  formatBalance,
  parseWalletError,
} from '../utils.js';
import { useWallet } from '../providers/WalletProvider/WalletProviderContext.js';
import { ConnectButton } from '../providers/WalletProvider/ConnectButton.js';

interface MakeDealProps {
  offer?: OfferData<RequestQuery, OfferOptions>;
  manager?: ClientDealsManager<RequestQuery, OfferOptions>;
}

/**
 * Making of deal form
 */
export const MakeDeal = ({ offer, manager }: MakeDealProps) => {
  const { account, walletClient } = useWallet();
  const [tx, setTx] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    setTx(undefined);
    setError(undefined);
    setLoading(false);
    setSuccess(false);
  }, [offer]);

  const dealHandler = useCallback(
    async (paymentId: Hash) => {
      try {
        setTx(undefined);
        setError(undefined);
        setLoading(true);

        if (!manager) {
          throw new Error('Client not ready');
        }

        if (!walletClient) {
          throw new Error('Ethereum client not ready');
        }

        if (!offer) {
          throw new Error('Invalid deal configuration');
        }

        await manager.create(offer, paymentId, ZeroHash, walletClient, setTx);
        setLoading(false);
        setSuccess(true);
      } catch (err) {
        console.log(err);
        setError(parseWalletError(err));
        setLoading(false);
      }
    },
    [manager, offer, walletClient],
  );

  if (!offer || !manager) {
    return null;
  }

  if (!account) {
    return (
      <div style={{ marginTop: 20 }}>
        <h3>Make a deal on offer: {centerEllipsis(offer.id)}</h3>
        <div>Please connect your wallet to continue</div>
        <div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Make a deal on offer: {centerEllipsis(offer.id)}</h3>
      <div>Offer options: {stringify(offer.options)}</div>
      <div>To make a deal choose a price option:</div>
      <div>
        <table border={1} cellPadding={5}>
          <thead>
            <tr>
              <td>Id</td>
              <td>Asset</td>
              <td>Price</td>
              <td>Action</td>
            </tr>
          </thead>
          <tbody>
            {offer.payment.map((p, index) => (
              <tr key={index}>
                <td>{centerEllipsis(p.id)}</td>
                <td>{p.asset}</td>
                <td>{formatBalance(p.price, 4)}</td>
                <td>
                  <button onClick={() => dealHandler(p.id)}>Deal</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {success && (
        <div style={{ marginTop: 20, color: 'green' }}>
          Deal for the offer {offer.payload.id} successfully created!
        </div>
      )}
      {!success && (
        <>
          {tx && <div style={{ marginTop: 20 }}>Tx hash: {tx}</div>}
          {loading && <div style={{ marginTop: 20 }}>Loading...</div>}
        </>
      )}
      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 10,
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
