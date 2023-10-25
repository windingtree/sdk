/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect } from "vitest";

export * from 'vitest';

process.on('unhandledRejection', (error) => {
  console.log('Unhandled rejection detected:', error);
});

/**
 * Validates objects equality
 *
 * @param {*} obj1
 * @param {*} obj2
 * @param {string} [parent]
 */
export const expectDeepEqual = (
  obj1: any,
  obj2: any,
  parent?: string,
): void => {
  for (const key of Object.keys(obj1)) {
    if (typeof obj1[key] === 'object') {
      expectDeepEqual(obj1[key], obj2[key], key);
      continue;
    }
    expect(obj1[key]).to.equal(
      obj2[key],
      `${parent ? parent + '.' : ''}${key}`,
    );
  }
};
