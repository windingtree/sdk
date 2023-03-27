import { expect } from './setup.js';
import { Type } from '@sinclair/typebox';
import { Wallet } from 'ethers';
import { ContractConfig } from '../src/utils/contract.js';
import { randomSalt, supplierId as spId, uuid4 } from '../src/utils/uid.js';
import {
  GenericQuerySchema,
  GenericOfferOptionsSchema,
  RequestData,
  OfferData,
  BuildRequestOptions,
  BuildOfferOptions,
  buildRequest,
  buildOffer,
  verifyOffer,
} from '../src/shared/messages-typebox.js';

const CustomQuerySchema = Type.Composite([
  GenericQuerySchema,
  Type.Object({
    guests: Type.Number(),
    rooms: Type.Number(),
  }),
]);

const CustomOfferOptionsSchema = Type.Composite([
  GenericOfferOptionsSchema,
  Type.Object({
    room: Type.String(),
    checkIn: Type.String(),
    checkOut: Type.String(),
  }),
]);

describe.skip('Shared.messages', () => {
  const signer = Wallet.createRandom();
  const supplierId = spId(randomSalt(), signer.address);
  const contractConfig: ContractConfig = {
    name: 'Test',
    version: '1',
    chainId: BigInt(1),
    address: signer.address,
  };
  let request: RequestData<typeof CustomQuerySchema>;

  const createRequest = (expire: number | string = 1) =>
    buildRequest<typeof CustomQuerySchema, BuildRequestOptions<typeof CustomQuerySchema>>({
      expire,
      nonce: 1,
      query: {
        guests: 2,
        rooms: 1,
      },
      querySchema: CustomQuerySchema,
    });

  const createOffer = (
    request: RequestData<typeof CustomQuerySchema>,
    expire: number | string = 1,
  ) =>
    buildOffer<
      typeof CustomQuerySchema,
      typeof CustomOfferOptionsSchema,
      BuildOfferOptions<typeof CustomQuerySchema, typeof CustomOfferOptionsSchema>
    >({
      contract: contractConfig,
      signer,
      querySchema: CustomQuerySchema,
      optionsSchema: CustomOfferOptionsSchema,
      supplierId,
      expire,
      request,
      options: {
        room: 'big',
        checkIn: '1',
        checkOut: '2',
      },
      payment: [
        {
          id: uuid4(),
          asset: '0x0',
          price: '1',
        },
      ],
      cancel: [
        {
          time: 1,
          penalty: 1,
        },
      ],
      checkIn: 1,
      transferable: true,
    });

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
      let offer: OfferData<typeof CustomQuerySchema, typeof CustomOfferOptionsSchema>;

      before(async () => {
        offer = await createOffer(request);
      });

      it('should restore an offer from raw data', async () => {
        const fromRaw = await buildOffer<
          typeof CustomQuerySchema,
          typeof CustomOfferOptionsSchema,
          BuildOfferOptions<typeof CustomQuerySchema, typeof CustomOfferOptionsSchema>
        >({
          contract: contractConfig,
          querySchema: CustomQuerySchema,
          optionsSchema: CustomOfferOptionsSchema,
          supplierId,
          expire: offer.expire,
          request: offer.request,
          options: offer.options,
          payment: offer.payment,
          cancel: offer.cancel,
          checkIn: offer.payload.checkIn,
          transferable: offer.payload.transferable,
          idOverride: offer.id,
          signatureOverride: offer.signature,
        });
        expect(fromRaw).to.deep.eq(offer);
      });

      it('should throw is signatureOverride not been provided', async () => {
        await expect(
          buildOffer<
            typeof CustomQuerySchema,
            typeof CustomOfferOptionsSchema,
            BuildOfferOptions<typeof CustomQuerySchema, typeof CustomOfferOptionsSchema>
          >({
            contract: contractConfig,
            querySchema: CustomQuerySchema,
            optionsSchema: CustomOfferOptionsSchema,
            supplierId,
            expire: offer.expire,
            request: offer.request,
            options: offer.options,
            payment: offer.payment,
            cancel: offer.cancel,
            checkIn: offer.payload.checkIn,
            transferable: offer.payload.transferable,
            idOverride: offer.id,
          }),
        ).to.rejectedWith('Either signer or signatureOverride must be provided');
      });
    });
  });

  describe('#verifyOffer', () => {
    let offer: OfferData<typeof CustomQuerySchema, typeof CustomOfferOptionsSchema>;

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
