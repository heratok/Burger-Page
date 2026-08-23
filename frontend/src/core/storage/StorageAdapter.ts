/**
 * Storage Adapter Interface (Seam)
 */
export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}

/**
 * LocalStorage implementation of StorageAdapter with error resilience.
 */
export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Ignore quota or permission errors
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore errors
    }
  }

  clear(): void {
    try {
      localStorage.clear()
    } catch {
      // Ignore errors
    }
  }
}

/**
 * In-Memory implementation of StorageAdapter for isolated unit tests.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
