import { TypedDataDomain } from 'abitype';

/**
 * Name of the access token, used as a key when storing in the server response header
 */
export const ACCESS_TOKEN_NAME = 'ACCESS_TOKEN';

/**
 * Typed domain for the admin signature
 */
export const adminDomain: TypedDataDomain = {
  name: 'Admin',
  version: '1',
} as const;

/** EIP-712 JSON schema types for node API server auth operation */
export const adminAuthEip712Types = {
  Admin: [
    {
      name: 'signer',
      type: 'address',
    },
  ],
} as const;
