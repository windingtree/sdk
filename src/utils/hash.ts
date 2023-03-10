import { solidityPackedKeccak256 } from 'ethers';

export const hashObject = <Obj>(obj: Obj | Obj[], serialize = JSON.stringify): string =>
  solidityPackedKeccak256(['string'], [serialize(obj)]);
