import { solidityPackedKeccak256 } from 'ethers';

/**
 * Hashes object using given serializer
 *
 * @template Obj
 * @param {(Obj | Obj[])} obj
 * @param {*} [serialize=JSON.stringify]
 * @returns {string}
 */
export const hashObject = <Obj>(obj: Obj | Obj[], serialize = JSON.stringify): string =>
  solidityPackedKeccak256(['string'], [serialize(obj)]);
