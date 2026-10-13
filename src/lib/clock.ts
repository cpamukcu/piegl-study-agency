// The current time for a server component. Call only after `await connection()`,
// so it runs once per request rather than at build time.
export function requestTime(): number {
  return Date.now();
}
