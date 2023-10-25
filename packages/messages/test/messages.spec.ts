import { mnemonicToAccount } from 'viem/accounts';
import {
  beforeAll,
  describe,
  expect,
  expectDeepEqual,
  it,
} from '@windingtree/sdk-test-utils';
import { generateMnemonic, supplierId as spId } from '@windingtree/sdk-utils';
import { randomSalt } from '@windingtree/contracts';
import { OfferData, RequestData } from '@windingtree/sdk-types';
import {
  createRandomOffer,
  createRandomRequest,
  CustomOfferOptions,
  CustomQuery,
} from '../src/index.js';
import {
  buildOffer,
  createCheckInOutSignature,
  verifyOffer,
} from '../src/index.js';

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

  let request: RequestData<CustomQuery>;

  beforeAll(async () => {
    request = await createRandomRequest(topic);
  });

  describe('#buildRequest', () => {
    it('should build a request', async () => {
      await expect(createRandomRequest(topic)).resolves.toBeTypeOf('object');
      await expect(createRandomRequest(topic, '1h')).resolves.toBeTypeOf(
        'object',
      );
    });
  });

  describe('#buildOffer', () => {
    it('should build an offer', async () => {
      try {
        await createRandomOffer(
          request,
          '30s',
          typedDomain,
          supplierId,
          signer,
        );
      } catch (error) {
        console.log(error);
      }
      await expect(
        createRandomOffer(request, BigInt(1), typedDomain, supplierId, signer),
      ).resolves.toBeTypeOf('object');
      await expect(
        createRandomOffer(request, '30s', typedDomain, supplierId, signer),
      ).resolves.toBeTypeOf('object');
    });

    describe('Offer restoration', () => {
      let offer: OfferData<CustomQuery, CustomOfferOptions>;

      beforeAll(async () => {
        offer = await createRandomOffer(
          request,
          BigInt(1),
          typedDomain,
          supplierId,
          signer,
        );
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

      it('should restore an offer from raw data without transferable option', async () => {
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

      it('should throw Chain Id must be provided with a typed domain', async () => {
        await expect(
          buildOffer<CustomQuery, CustomOfferOptions>({
            domain: {},
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
        ).rejects.toThrow('Chain Id must be provided with a typed domain');
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
        ).rejects.toThrow(
          'Either account or signatureOverride must be provided with options',
        );
      });
    });
  });

  describe('#verifyOffer', () => {
    let offer: OfferData<CustomQuery, CustomOfferOptions>;

    beforeAll(async () => {
      offer = await createRandomOffer(
        request,
        BigInt(1),
        typedDomain,
        supplierId,
        signer,
      );
    });

    it('should throw if wrong signer provided', async () => {
      const unknownSigner = mnemonicToAccount(generateMnemonic());
      await expect(
        verifyOffer({
          domain: typedDomain,
          address: unknownSigner.address,
          offer,
        }),
      ).rejects.toThrow(`Invalid offer signer ${unknownSigner.address}`);
    });

    it('should verify an offer', async () => {
      await expect(
        verifyOffer({
          domain: typedDomain,
          address: signer.address,
          offer,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('#createCheckInOutSignature', () => {
    let offer: OfferData<CustomQuery, CustomOfferOptions>;

    beforeAll(async () => {
      offer = await createRandomOffer(
        request,
        BigInt(1),
        typedDomain,
        supplierId,
        signer,
      );
    });

    it('should create check in out signature', async () => {
      await expect(
        createCheckInOutSignature({
          offerId: offer.id,
          domain: typedDomain,
          account: signer,
          address: signer.address,
        }),
      ).resolves.toBeTypeOf('string');
    });

    it('should create check in out signature without address', async () => {
      await expect(
        createCheckInOutSignature({
          offerId: offer.id,
          domain: typedDomain,
          account: signer,
        }),
      ).resolves.toBeTypeOf('string');
    });
  });
});
