import { generateKeyPair } from '@libp2p/crypto/keys';
import { toString } from 'uint8arrays/to-string';

// Generate secp256k1 private key
const keyPair = await generateKeyPair('secp256k1');

const serverPeerKey = {
  id: await keyPair.id(),
  pubKey: toString(keyPair.public.bytes, 'base64pad'),
  privKey: toString(keyPair.bytes, 'base64pad'),
};

// eslint-disable-next-line no-undef
console.log(JSON.stringify(serverPeerKey, null, 2));
