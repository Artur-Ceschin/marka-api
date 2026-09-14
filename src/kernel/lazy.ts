/**
 * Builds a value on first call and returns the same instance afterwards.
 *
 * Used for SDK clients: they open connection pools, and a module-level instance
 * survives between warm Lambda invocations, so each is created once per
 * container — and only by a code path that actually needs it. Deferring
 * construction also means a missing env var fails the route that uses it, not
 * every route at import time.
 */
export function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= create());
}
