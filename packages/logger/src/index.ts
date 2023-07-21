import debug from 'debug';

/**
 Default formatters:
  %O	Pretty-print an Object on multiple lines.
  %o	Pretty-print an Object all on a single line.
  %s	String.
  %d	Number (both integer and float).
  %j	JSON. Replaced with the string '[Circular]' if the argument contains circular references.
  %%	Single percent sign ('%'). This does not consume an argument.
 */

/**
 * Logger interface
 */
export interface Logger {
  (formatter: unknown, ...args: unknown[]): void;
  error: (formatter: unknown, ...args: unknown[]) => void;
  trace: (formatter: unknown, ...args: unknown[]) => void;
  enabled: boolean;
}

/**
 * Creates logger instance
 *
 * @param {string} name
 * @returns {Logger}
 */
export const createLogger = (name: string): Logger => {
  return Object.assign(debug(name), {
    error: debug(`${name}:error`),
    trace: debug(`${name}:trace`),
  });
};

/**
 * Enables logging for named scope
 *
 * @param {string} name
 */
export const enable = (name: string): void => debug.enable(name);

/**
 * Disables logging for named scope
 **/
export const disable = (): string => debug.disable();
