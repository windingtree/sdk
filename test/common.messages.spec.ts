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
} from '../src/common/messages.js';

describe('Common.messages', () => {
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

  const createRequest = () =>
    buildRequest<CustomQuery>(
      1,
      1,
      {
        guests: 2,
        rooms: 1,
      },
      CustomQuerySchema,
    );

  const signer = Wallet.createRandom();
  const supplierId = spId(randomSalt(), signer.address);
  const contractConfig: ContractConfig = {
    name: 'Test',
    version: '1',
    chainId: BigInt(1),
    address: signer.address,
  };

  const createOffer = (request: RequestData<CustomQuery>) =>
    buildOffer<CustomQuery, CustomOfferOptions>(
      contractConfig,
      signer,
      1,
      supplierId,
      request,
      {
        room: 'big',
        checkIn: '1',
        checkOut: '2',
      },
      [
        {
          id: uuid4(),
          asset: '0x0',
          price: '1',
        },
      ],
      [
        {
          time: 1,
          penalty: 1,
        },
      ],
      1,
      true,
      CustomQuerySchema,
      CustomOfferOptionsSchema,
    );

  let request: RequestData<CustomQuery>;

  before(async () => {
    request = await createRequest();
  });

  describe('#buildRequest', () => {
    it('should build a request', async () => {
      await expect(createRequest()).to.not.rejected;
    });
  });

  describe('#buildOffer', () => {
    it('should build an offer', async () => {
      await expect(createOffer(request)).to.not.rejected;
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
