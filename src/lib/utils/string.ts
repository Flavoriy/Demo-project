/**
 * Truncates a string to a specified length and appends a suffix (default is '...')
 * if the string exceeds the limit.
 */
export function truncateString(str: string, limit: number, suffix = "..."): string {
  if (!str) return "";
  if (str.length <= limit) return str;
  return str.slice(0, limit) + suffix;
}
