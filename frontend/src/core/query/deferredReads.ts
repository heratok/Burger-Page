import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query"

// Reads that landed while writes of their resource were in flight, per client:
// they were not applied (the cached data was kept) and must be re-read once the
// last write settles.
const deferredReads = new WeakMap<QueryClient, Set<string>>()

/** Remembers that a read of this key was not applied because writes were pending. */
export function deferRead(client: QueryClient, queryKey: QueryKey): void {
  const set = deferredReads.get(client) ?? new Set<string>()
  set.add(hashKey(queryKey))
  deferredReads.set(client, set)
}

/** True (once) when a read of this key was deferred by a pending write. */
export function takeDeferredRead(client: QueryClient, queryKey: QueryKey): boolean {
  const set = deferredReads.get(client)
  const hash = hashKey(queryKey)
  if (!set?.has(hash)) return false
  set.delete(hash)
  return true
}
