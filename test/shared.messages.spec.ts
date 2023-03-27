import { expect } from './setup.js';
import { z } from 'zod';
import { Wallet } from 'ethers';
import { ContractConfig } from '../src/utils/contract.js';
import { randomSalt, supplierId as spId, uuid4 } from '../src/utils/uid.js';
import {
  GenericQuerySchema,
  GenericOfferOptionsSchema,
  RequestData,
  OfferData,
  buildRequest,
  buildOffer,
  verifyOffer,
} from '../src/shared/messages.js';

describe('Shared.messages', () => {
  const topic = 'test';
  const CustomQuerySchema = GenericQuerySchema.extend({
    guests: z.number(),
    rooms: z.number(),
  });
  type CustomQuery = z.infer<typeof CustomQuerySchema>;

  const CustomOfferOptionsSchema = GenericOfferOptionsSchema.extend({
    room: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
  });
  type CustomOfferOptions = z.infer<typeof CustomOfferOptionsSchema>;

  const createRequest = (expire: number | string = 1) =>
    buildRequest<CustomQuery>({
      expire,
      nonce: 1,
      topic,
      query: {
        guests: 2,
        rooms: 1,
      },
      querySchema: CustomQuerySchema,
    });

  const signer = Wallet.createRandom();
  const supplierId = spId(randomSalt(), signer.address);
  const contractConfig: ContractConfig = {
    name: 'Test',
    version: '1',
    chainId: BigInt(1),
    address: signer.address,
  };

  const createOffer = (request: RequestData<CustomQuery>, expire: number | string = 1) =>
    buildOffer<CustomQuery, CustomOfferOptions>({
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
          buildOffer<CustomQuery, CustomOfferOptions>({
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
