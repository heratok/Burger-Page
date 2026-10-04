import { hydrate, type QueryClient } from "@tanstack/react-query"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import {
  persistQueryClientSubscribe,
  type PersistedClient,
  type PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client"
import { isPublicStorefrontKey } from "./keys"

/** localStorage key of the persisted (storefront-only) query cache. */
export const PERSISTED_QUERIES_KEY = "burger_page_query_cache_v1"
/** Cache version: bump it when a persisted query's data shape changes. */
export const PERSIST_BUSTER = "storefront-v1"
/** A persisted cache older than this is discarded on restore. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000

// The persister throttles its writes and writes the LATEST snapshot when the
// timer fires, so a snapshot taken before a purge (logout) could otherwise be
// written after it. Such snapshots, and empty ones, remove the key instead.
let purgedAt = 0
const SKIP = ""
const guardedStorage =
  typeof window !== "undefined"
    ? {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          if (value === SKIP) window.localStorage.removeItem(key)
          else window.localStorage.setItem(key, value)
        },
        removeItem: (key: string) => window.localStorage.removeItem(key),
      }
    : undefined

export const queryPersister = createSyncStoragePersister({
  storage: guardedStorage,
  key: PERSISTED_QUERIES_KEY,
  serialize: (client) =>
    client.timestamp <= purgedAt || client.clientState.queries.length === 0 ? SKIP : JSON.stringify(client),
})

/**
 * Offline reads (T4.2, option A): only the public storefront survives a
 * reload, so a customer opening the store offline still sees the last menu.
 * Whitelist, never a blacklist: a query is written only when its key is a
 * guest storefront key (restaurant record by slug, products, additions) and it
 * holds data. Orders, customers, stock, users, the audit log, tables, the
 * directory and anything keyed by a non-guest role are never persisted. The
 * pending-orders queue has its own storage.
 */
export const storefrontPersistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === "success" && isPublicStorefrontKey(query.queryKey),
  },
}

/** Drops the persisted cache (session end, together with queryClient.clear()). */
export async function clearPersistedQueries(): Promise<void> {
  purgedAt = Date.now()
  await queryPersister.removeClient()
}

const restoredClients = new WeakSet<QueryClient>()

/**
 * Restores the persisted storefront cache into a client, synchronously and
 * once, before its first render: the last menu is on screen immediately and
 * no query waits on an async restore. A cache that is expired (maxAge),
 * busted (another cache version) or unreadable is dropped, and only
 * whitelisted storefront queries are ever hydrated back.
 */
export function restorePersistedQueries(client: QueryClient): void {
  if (restoredClients.has(client)) return
  restoredClients.add(client)
  try {
    const persisted = queryPersister.restoreClient() as PersistedClient | undefined
    if (!persisted?.timestamp) return
    if (Date.now() - persisted.timestamp > PERSIST_MAX_AGE || persisted.buster !== PERSIST_BUSTER) {
      void queryPersister.removeClient()
      return
    }
    hydrate(client, {
      ...persisted.clientState,
      queries: persisted.clientState.queries.filter((q) => isPublicStorefrontKey(q.queryKey)),
      mutations: [],
    })
  } catch {
    void queryPersister.removeClient()
  }
}

/** Saves the whitelisted queries whenever the cache changes; returns the unsubscribe. */
export function subscribePersistedQueries(client: QueryClient): () => void {
  return persistQueryClientSubscribe({ queryClient: client, ...storefrontPersistOptions })
}
