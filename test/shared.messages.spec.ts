import { expect, expectDeepEqual } from './setup.js';
import { mnemonicToAccount } from 'viem/accounts';
import { generateMnemonic } from '../src/utils/wallet.js';
import { supplierId as spId } from '../src/utils/uid.js';
import { randomSalt } from '@windingtree/contracts';
import { GenericQuery, GenericOfferOptions, RequestData, OfferData } from '../src/shared/types.js';
import { buildRequest, buildOffer, verifyOffer } from '../src/shared/messages.js';

interface CustomQuery extends GenericQuery {
  guests: bigint;
  rooms: bigint;
}

interface CustomOfferOptions extends GenericOfferOptions {
  room: string;
  checkIn: bigint;
  checkOut: bigint;
}

describe('Shared.messages', () => {
  const topic = 'test';
  const signer = mnemonicToAccount(generateMnemonic());
  const typedDomain = {
    chainId: 1,
    name: 'Test',
    version: '1',
    contract: signer.address,
  };
  const supplierId = spId(randomSalt(), signer.address);

  const createRequest = (expire: bigint | string = BigInt(1)) =>
    buildRequest<CustomQuery>({
      expire,
      nonce: BigInt(1),
      topic,
      query: {
        guests: BigInt(2),
        rooms: BigInt(1),
      },
    });

  const createOffer = (request: RequestData<CustomQuery>, expire: bigint | string = BigInt(1)) =>
    buildOffer<CustomQuery, CustomOfferOptions>({
      domain: typedDomain,
      account: signer,
      supplierId,
      expire,
      request,
      options: {
        room: 'big',
        checkIn: 1n,
        checkOut: 2n,
      },
      payment: [
        {
          id: randomSalt(),
          asset: signer.address, // fake
          price: 1n,
        },
      ],
      cancel: [
        {
          time: 1n,
          penalty: 1n,
        },
      ],
      checkIn: 1n,
      checkOut: 1n,
      transferable: true,
    });

  let request: RequestData<CustomQuery>;

  before(async () => {
    request = await createRequest();
  });

  describe('#buildRequest', () => {
    it('should build a request', async () => {
      await expect(createRequest()).to.not.rejected;
      await expect(createRequest('1h')).to.not.rejected;
    });
  });

  describe('#buildOffer', () => {
    it('should build an offer', async () => {
      try {
        await createOffer(request, '30s');
      } catch (error) {
        console.log(error);
      }
      await expect(createOffer(request)).to.not.rejected;
      await expect(createOffer(request, '30s')).to.not.rejected;
    });

    describe('Offer restoration', () => {
      let offer: OfferData<CustomQuery, CustomOfferOptions>;

      before(async () => {
        offer = await createOffer(request);
      });

      it('should restore an offer from raw data', async () => {
        const fromRaw = await buildOffer<CustomQuery, CustomOfferOptions>({
          domain: typedDomain,
          account: signer,
          supplierId,
          expire: offer.expire,
          request: offer.request,
          options: offer.options,
          payment: offer.payment,
          cancel: offer.cancel,
          checkIn: offer.payload.checkIn,
          checkOut: offer.payload.checkOut,
          transferable: offer.payload.transferable,
          idOverride: offer.id,
          signatureOverride: offer.signature,
        });
        expectDeepEqual(fromRaw, offer);
      });

      it('should throw is signatureOverride not been provided', async () => {
        await expect(
          buildOffer<CustomQuery, CustomOfferOptions>({
            domain: typedDomain,
            supplierId,
            expire: offer.expire,
            request: offer.request,
            options: offer.options,
            payment: offer.payment,
            cancel: offer.cancel,
            checkIn: offer.payload.checkIn,
            checkOut: offer.payload.checkOut,
            transferable: offer.payload.transferable,
            idOverride: offer.id,
          }),
        ).to.rejectedWith('Either account or signatureOverride must be provided with options');
      });
    });
  });

  describe('#verifyOffer', () => {
    let offer: OfferData<CustomQuery, CustomOfferOptions>;

    before(async () => {
      offer = await createOffer(request);
    });

    it('should throw if wrong signer provided', async () => {
      const unknownSigner = mnemonicToAccount(generateMnemonic());
      await expect(
        verifyOffer({
          domain: typedDomain,
          address: unknownSigner.address,
          offer,
        }),
      ).to.rejectedWith(`Invalid offer signer ${unknownSigner.address}`);
    });

    it('should verify an offer', async () => {
      await expect(
        verifyOffer({
          domain: typedDomain,
          address: signer.address,
          offer,
        }),
      ).to.not.rejected;
    });
  });
});
