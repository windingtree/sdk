export const decodeText = (buffer: BufferSource) => new TextDecoder().decode(buffer);

export const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);
