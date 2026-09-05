import { describe, it, expect, beforeEach } from "vitest"
import {
  TenantRepository,
  DEFAULT_ENVELOPE,
  STORAGE_KEYS,
} from "./TenantRepository"
import { InMemoryStorageAdapter } from "./StorageAdapter"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

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
    expect(envelope.restaurants).toHaveLength(0)
  })

  it("persists and reloads modified envelope", () => {
    repo.saveEnvelope(TEST_STORAGE_ENVELOPE)

    const reloaded = repo.loadEnvelope()
    expect(reloaded.restaurants).toHaveLength(TEST_STORAGE_ENVELOPE.restaurants.length)
    expect(reloaded.restaurants[0].id).toBe(TEST_STORAGE_ENVELOPE.restaurants[0].id)
  })

  it("persists and retrieves active restaurant ID", () => {
    expect(repo.getActiveRestaurantId()).toBe("rest-burger-craft")

    repo.setActiveRestaurantId("pizzeria-napoli")
    expect(repo.getActiveRestaurantId()).toBe("pizzeria-napoli")
  })

  it("finds a restaurant by ID or slug case-insensitively", () => {
    const foundBySlug = repo.findRestaurant(TEST_STORAGE_ENVELOPE, "BURGER-CRAFT")
    expect(foundBySlug).toBeDefined()
    expect(foundBySlug?.slug).toBe("burger-craft")

    const foundById = repo.findRestaurant(TEST_STORAGE_ENVELOPE, "rest-burger-craft")
    expect(foundById).toBeDefined()
  })

  it("falls back to DEFAULT_ENVELOPE if stored data is corrupted JSON", () => {
    adapter.setItem(STORAGE_KEYS.ENVELOPE, "{ invalid json corrupt")
    const envelope = repo.loadEnvelope()
    expect(envelope.version).toBe(2)
    expect(envelope.restaurants).toHaveLength(DEFAULT_ENVELOPE.restaurants.length)
  })
})
