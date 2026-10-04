import { useCallback, useRef, useSyncExternalStore } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { RestaurantRecord, StorefrontConfig, UserRole } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { scheduleFieldsFromApi } from "@/lib/storeSchedule"
import { keys } from "@/core/query/keys"

/**
 * Restaurant records are server state: the directory lives under
 * keys.restaurants(role) and every single restaurant (looked up by slug or
 * id, or seeded from a directory read) under keys.restaurant(role, idOrSlug).
 * The active restaurant and its store config are read from those entries.
 */

/** Merges the public/admin payload into a storefront config: schedule fields come from the top level, the legacy text is dropped. */
function configFromApi(fetched: any, base: StorefrontConfig): StorefrontConfig {
  const { openingHours: _legacyText, ...config } = (fetched.config || {}) as Record<string, unknown>
  return { ...base, ...config, ...scheduleFieldsFromApi({ ...base, ...fetched }) } as StorefrontConfig
}

/**
 * Maps a backend restaurant to the domain record. Fields the payload omits
 * fall back to the cached record of the same restaurant (when given), never to
 * another tenant. SUS-20: the one-time admin password is never copied.
 */
export function toRestaurantRecord(fetched: any, cached?: RestaurantRecord): RestaurantRecord {
  const base = { ...DEFAULT_STORE_CONFIG, ...(cached?.config ?? {}) }
  return {
    id: fetched.id,
    slug: fetched.slug,
    isActive: fetched.isActive !== undefined ? Boolean(fetched.isActive) : true,
    createdAt: fetched.createdAt || cached?.createdAt || new Date().toISOString(),
    // Zero categories is a valid state: a list (even []) from the backend
    // wins; only an omitted list falls back to the cached one.
    categories: Array.isArray(fetched.categories) ? fetched.categories : cached?.categories ?? [],
    config: {
      ...configFromApi(fetched, base),
      name: fetched.name || fetched.config?.name || cached?.config?.name || DEFAULT_STORE_CONFIG.name,
      tagline: fetched.tagline || fetched.config?.tagline || cached?.config?.tagline || DEFAULT_STORE_CONFIG.tagline,
    },
  }
}

const isRecord = (value: unknown): value is RestaurantRecord =>
  Boolean(value && typeof value === "object" && (value as RestaurantRecord).id)

/** Every restaurant entry of this role's cache (lookups and directory seeds), insertion order. */
function restaurantEntries(client: QueryClient, role: UserRole): RestaurantRecord[] {
  return client
    .getQueryCache()
    .findAll({ queryKey: ["restaurant", role] })
    .map((query) => query.state.data)
    .filter(isRecord)
}

/** Every restaurant resolved by lookup for this role (storefront visits, directory seeds), deduplicated. */
function lookedUpRestaurants(client: QueryClient, role: UserRole): RestaurantRecord[] {
  const byId = new Map<string, RestaurantRecord>()
  for (const entry of restaurantEntries(client, role)) if (!byId.has(entry.id)) byId.set(entry.id, entry)
  return Array.from(byId.values())
}

/**
 * The restaurant list of a role. Once the directory has been read (admins) it
 * is authoritative: exactly the listed restaurants, each read from its
 * keys.restaurant entry. Without a directory (storefront visitors) it is the
 * restaurants resolved by lookup.
 */
export function knownRestaurants(client: QueryClient, role: UserRole): RestaurantRecord[] {
  const directory = client.getQueryData<RestaurantRecord[]>(keys.restaurants(role))
  if (!directory) return lookedUpRestaurants(client, role)
  return directory.map((item) => client.getQueryData<RestaurantRecord>(keys.restaurant(role, item.id)) ?? item)
}

/** Resolves a restaurant by id or slug among the directory and every lookup of this role. */
export function resolveRestaurant(client: QueryClient, role: UserRole, idOrSlug: string): RestaurantRecord | undefined {
  return (
    findRestaurant(knownRestaurants(client, role), idOrSlug) ??
    findRestaurant(lookedUpRestaurants(client, role), idOrSlug)
  )
}

/** Forgets a looked-up restaurant (e.g. a tenant this session may not open). */
export function forgetRestaurant(client: QueryClient, role: UserRole, record: RestaurantRecord, idOrSlug: string): void {
  for (const key of [record.id, record.slug, idOrSlug]) client.removeQueries({ queryKey: keys.restaurant(role, key), exact: true })
}

export function findRestaurant(list: RestaurantRecord[], idOrSlug: string): RestaurantRecord | undefined {
  const lower = idOrSlug.toLowerCase()
  return list.find((r) => r.id === idOrSlug || r.slug.toLowerCase() === lower)
}

/** Registers a resolved restaurant under its id (and slug) for this role. */
export function seedRestaurant(client: QueryClient, role: UserRole, record: RestaurantRecord): void {
  client.setQueryData(keys.restaurant(role, record.id), record)
  client.setQueryData(keys.restaurant(role, record.slug), record)
}

/**
 * Maps a directory read, seeding each restaurant's keys.restaurant entry (so
 * the active restaurant always reads the latest server record).
 */
export function seedDirectory(client: QueryClient, role: UserRole, backend: any[]): RestaurantRecord[] {
  return backend
    .filter((br) => br && br.id)
    .map((br) => {
      const cached = client.getQueryData<RestaurantRecord>(keys.restaurant(role, br.id))
      const record = toRestaurantRecord(br, cached)
      seedRestaurant(client, role, record)
      return record
    })
}

/** Snapshot of one restaurant's cached copies, to undo an optimistic write. */
export interface RestaurantSnapshot {
  directory: RestaurantRecord[] | undefined
  entries: Array<[readonly unknown[], unknown]>
}

export function snapshotRestaurant(client: QueryClient, role: UserRole, id: string): RestaurantSnapshot {
  return {
    directory: client.getQueryData<RestaurantRecord[]>(keys.restaurants(role)),
    entries: client
      .getQueryCache()
      .findAll({ queryKey: ["restaurant", role] })
      .filter((q) => isRecord(q.state.data) && (q.state.data as RestaurantRecord).id === id)
      .map((q) => [q.queryKey, q.state.data]),
  }
}

export function restoreRestaurant(client: QueryClient, role: UserRole, snapshot: RestaurantSnapshot): void {
  if (snapshot.directory) client.setQueryData(keys.restaurants(role), snapshot.directory)
  for (const [key, data] of snapshot.entries) client.setQueryData(key, data)
}

/** Applies a local change to every cached copy of one restaurant (directory item and entries). */
export function patchRestaurant(
  client: QueryClient,
  role: UserRole,
  id: string,
  updater: (record: RestaurantRecord) => RestaurantRecord
): void {
  client.setQueryData<RestaurantRecord[]>(keys.restaurants(role), (list) =>
    list?.map((r) => (r.id === id ? updater(r) : r))
  )
  for (const query of client.getQueryCache().findAll({ queryKey: ["restaurant", role] })) {
    const data = query.state.data
    if (isRecord(data) && data.id === id) client.setQueryData(query.queryKey, updater(data))
  }
}

/** Registers a new record (an optimistic creation): in the directory when there is one. */
export function addToDirectory(client: QueryClient, role: UserRole, record: RestaurantRecord): void {
  client.setQueryData<RestaurantRecord[]>(keys.restaurants(role), (list) => (list ? [...list, record] : list))
  seedRestaurant(client, role, record)
}

const sameList = (a: RestaurantRecord[], b: RestaurantRecord[]) =>
  a.length === b.length && a.every((r, i) => r === b[i])

/**
 * Subscribes to changes of the restaurant entries and the directory. Only
 * events that can change their data notify: a query that useQuery builds
 * (empty) or observes while a component renders must not re-render the
 * subscribers in the middle of that render.
 */
const subscribeRestaurants = (client: QueryClient) => (notify: () => void) =>
  client.getQueryCache().subscribe((event) => {
    const resource = event.query.queryKey[0]
    if (resource !== "restaurant" && resource !== "restaurants") return
    const changesData =
      event.type === "updated" || event.type === "removed" || (event.type === "added" && event.query.state.data !== undefined)
    if (changesData) notify()
  })

/** One restaurant (by id or slug) as cached for a role, re-rendering when its record changes. */
export function useResolvedRestaurant(
  client: QueryClient,
  role: UserRole,
  idOrSlug: string
): RestaurantRecord | undefined {
  const subscribe = useCallback((notify: () => void) => subscribeRestaurants(client)(notify), [client])
  const getSnapshot = useCallback(
    () => (idOrSlug ? resolveRestaurant(client, role, idOrSlug) : undefined),
    [client, role, idOrSlug]
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** The known restaurants of a role, re-rendering only when one of them changes. */
export function useKnownRestaurants(client: QueryClient, role: UserRole): RestaurantRecord[] {
  const last = useRef<RestaurantRecord[]>([])
  const subscribe = useCallback((notify: () => void) => subscribeRestaurants(client)(notify), [client])
  const getSnapshot = useCallback(() => {
    const next = knownRestaurants(client, role)
    if (!sameList(last.current, next)) last.current = next
    return last.current
  }, [client, role])
  return useSyncExternalStore(subscribe, getSnapshot)
}
