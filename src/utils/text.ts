/**
 * Decodes text from buffer
 *
 * @param {BufferSource} buffer
 */
export const decodeText = (buffer: BufferSource) => new TextDecoder().decode(buffer);

/**
 * Encodes text to buffer
 *
 * @param {string} text
 */
export const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);
