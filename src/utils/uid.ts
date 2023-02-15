// Generates simple unique Id
export const simpleUid = (length = 14): string => {
  if (length < 5 || length > 14) {
    throw new Error('length value must be between 5 and 14');
  }
  return Math.random()
    .toString(16)
    .replace('.', '')
    .split('')
    .sort(() => (Math.random() > 0.5 ? 1 : -1))
    .join('')
    .slice(0, length);
};
