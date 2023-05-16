import { expect, expectDeepEqual } from './setup.js';
import { Wallet, BigNumberish } from 'ethers';
import { ContractConfig } from '../src/utils/contract.js';
import { randomSalt, supplierId as spId } from '../src/utils/uid.js';
import { GenericQuery, GenericOfferOptions, RequestData, OfferData } from '../src/shared/types.js';
import { buildRequest, buildOffer, verifyOffer } from '../src/shared/messages.js';

interface CustomQuery extends GenericQuery {
  guests: BigNumberish;
  rooms: BigNumberish;
}

interface CustomOfferOptions extends GenericOfferOptions {
  room: string;
  checkIn: BigNumberish;
  checkOut: BigNumberish;
}

describe('Shared.messages', () => {
  const topic = 'test';

  const createRequest = (expire: BigNumberish | string = 1) =>
    buildRequest<CustomQuery>({
      expire,
      nonce: 1,
      topic,
      query: {
        guests: 2,
        rooms: 1,
      },
    });

  const signer = Wallet.createRandom();
  const supplierId = spId(randomSalt(), signer.address);
  const contractConfig: ContractConfig = {
    name: 'Test',
    version: '1',
    chainId: BigInt(1),
    address: signer.address,
  };

  const createOffer = (request: RequestData<CustomQuery>, expire: BigNumberish | string = 1) =>
    buildOffer<CustomQuery, CustomOfferOptions>({
      contract: contractConfig,
      signer,
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
          asset: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
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
          contract: contractConfig,
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
            contract: contractConfig,
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
        ).to.rejectedWith('Either signer or signatureOverride must be provided');
      });
    });
  });

  describe('#verifyOffer', () => {
    let offer: OfferData<CustomQuery, CustomOfferOptions>;

    before(async () => {
      offer = await createOffer(request);
    });

    it('should throw if wrong signer provided', () => {
      const unknownSigner = Wallet.createRandom();
      expect(() => verifyOffer(contractConfig, unknownSigner.address, offer)).to.throw(
        `Invalid offer signer ${unknownSigner.address}`,
      );
    });

    it('should verify an offer', () => {
      expect(() => verifyOffer(contractConfig, signer.address, offer)).to.not.throws;
    });
  });
});
