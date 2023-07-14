import { mnemonicToAccount } from 'viem/accounts';
import {
  expect,
  describe,
  it,
  beforeAll,
  expectDeepEqual,
  CustomQuery,
  CustomOfferOptions,
  createRequest,
  createOffer,
} from '@windingtree/sdk-test-utils';
import { supplierId as spId } from '@windingtree/sdk-utils/uid';
import { randomSalt } from '@windingtree/contracts';
import { RequestData, OfferData } from '@windingtree/sdk-types';
import { generateMnemonic } from '@windingtree/sdk-utils/wallet';
import { buildOffer, verifyOffer } from '../src/index.js';

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
    request = await createRequest(topic);
  });

  describe('#buildRequest', () => {
    it('should build a request', async () => {
      await expect(createRequest(topic)).resolves.toBeTypeOf('object');
      await expect(createRequest(topic, '1h')).resolves.toBeTypeOf('object');
    });
  });

  describe('#buildOffer', () => {
    it('should build an offer', async () => {
      try {
        await createOffer(request, '30s', typedDomain, supplierId, signer);
      } catch (error) {
        console.log(error);
      }
      await expect(
        createOffer(request, BigInt(1), typedDomain, supplierId, signer),
      ).resolves.toBeTypeOf('object');
      await expect(
        createOffer(request, '30s', typedDomain, supplierId, signer),
      ).resolves.toBeTypeOf('object');
    });

    describe('Offer restoration', () => {
      let offer: OfferData<CustomQuery, CustomOfferOptions>;

      beforeAll(async () => {
        offer = await createOffer(
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
      offer = await createOffer(
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
});
