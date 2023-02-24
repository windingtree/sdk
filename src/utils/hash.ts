import { solidityPackedKeccak256 } from 'ethers';

export const hashObject = <Obj>(obj: Obj | Obj[]): string => solidityPackedKeccak256(['string'], [JSON.stringify(obj)]);
