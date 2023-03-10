import { DateTime } from 'luxon';

// Calculation bases
const s = 1;
const ms = s * 0.001;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const y = d * 365.25;

export type AllowedDurationType = 'ms' | 's' | 'm' | 'h' | 'd' | 'y';

export interface DurationFormat {
  type: AllowedDurationType;
  value: number;
}

export const validateDurationFormat = (str: string): DurationFormat => {
  const match = /^((?:\d+)?\.?\d+) *(ms|s|m|h|d|y)$/i.exec(str); // milliseconds|seconds|minutes|hours|days|years

  if (!match) {
    throw new Error('Unknown duration time format');
  }

  return {
    value: parseFloat(match[1]),
    type: match[2].toLocaleLowerCase() as AllowedDurationType,
  };
};

// Parses formatted string into seconds number value
export const parseSeconds = (str: string | number): number => {
  if (typeof str === 'number') {
    return str;
  }

  str = String(str);

  const { type, value } = validateDurationFormat(str);
  let parsed = 0;

  switch (type) {
    case 'ms':
      parsed = value * ms;
      if (parsed < 1) {
        parsed = 0;
      }
      break;
    case 's':
      parsed = value * s;
      break;
    case 'm':
      parsed = value * m;
      break;
    case 'h':
      parsed = value * h;
      break;
    case 'd':
      parsed = value * d;
      break;
    case 'y':
      parsed = value * y;
      break;
    /* c8 ignore next 3 */
    default:
      // Should not occur
      throw new Error('Unknown duration type');
  }

  return Math.ceil(parsed);
};

// Converts milliseconds to seconds
export const millisToSec = (time: number) => Math.round(time / 1000);

// Returns current time in seconds
export const nowSec = () => Math.round(DateTime.now().toSeconds());

// Checks expiration time
export const isExpired = (expire: number): boolean => nowSec() > expire;
