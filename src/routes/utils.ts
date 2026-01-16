export const isInteger = (str: string): boolean => {
  const trimmed = str.trim();
  return /^\d+$/.test(trimmed);
};
