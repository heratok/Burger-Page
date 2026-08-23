import { describe, it, expect, beforeEach } from "vitest"
import {
  TenantRepository,
  DEFAULT_ENVELOPE,
  STORAGE_KEYS,
} from "./TenantRepository"
import { InMemoryStorageAdapter } from "./StorageAdapter"

describe("TenantRepository with InMemoryStorageAdapter", () => {
  let adapter: InMemoryStorageAdapter
  let repo: TenantRepository

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter()
    repo = new TenantRepository(adapter)
  })

  it("returns DEFAULT_ENVELOPE when storage is empty", () => {
    const envelope = repo.loadEnvelope()
    expect(envelope.version).toBe(2)
    expect(envelope.restaurants.length).toBeGreaterThanOrEqual(3)
  })

  it("persists and reloads modified envelope", () => {
    const envelope = repo.loadEnvelope()
    const modified = {
      ...envelope,
      restaurants: [envelope.restaurants[0]],
    }

    repo.saveEnvelope(modified)

    const reloaded = repo.loadEnvelope()
    expect(reloaded.restaurants).toHaveLength(1)
    expect(reloaded.restaurants[0].id).toBe(envelope.restaurants[0].id)
  })

  it("persists and retrieves active restaurant ID", () => {
    expect(repo.getActiveRestaurantId()).toBe("rest-burger-craft")

    repo.setActiveRestaurantId("pizzeria-napoli")
    expect(repo.getActiveRestaurantId()).toBe("pizzeria-napoli")
  })

  it("finds a restaurant by ID or slug case-insensitively", () => {
    const envelope = repo.loadEnvelope()
    const foundBySlug = repo.findRestaurant(envelope, "BURGER-CRAFT")
    expect(foundBySlug).toBeDefined()
    expect(foundBySlug?.slug).toBe("burger-craft")

    const foundById = repo.findRestaurant(envelope, "rest-burger-craft")
    expect(foundById).toBeDefined()
  })

  it("falls back to DEFAULT_ENVELOPE if stored data is corrupted JSON", () => {
    adapter.setItem(STORAGE_KEYS.ENVELOPE, "{ invalid json corrupt")
    const envelope = repo.loadEnvelope()
    expect(envelope.version).toBe(2)
    expect(envelope.restaurants).toHaveLength(DEFAULT_ENVELOPE.restaurants.length)
  })
})
