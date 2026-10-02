import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAuditLogRepository } from '../../../src/infrastructure/persistence/InMemoryAuditLogRepository.js';
import { AuditLogEntry } from '../../../src/domain/models/AuditLogEntry.js';

const entry = (n: number, over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: `aud_${String(n).padStart(3, '0')}`,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
  actorUserId: 'usr_1',
  actorUsername: 'root',
  action: 'restaurant.update',
  targetType: 'restaurant',
  targetId: 'rest_1',
  targetLabel: 'Rest',
  restaurantId: 'rest_1',
  details: {},
  ...over,
});

describe('InMemoryAuditLogRepository', () => {
  let repo: InMemoryAuditLogRepository;
  beforeEach(() => {
    repo = new InMemoryAuditLogRepository();
  });

  it('is append-only: the port exposes no update or delete', () => {
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(repo)).sort()).toEqual(['constructor', 'list', 'record']);
  });

  it('lists newest first with a keyset cursor that never skips or repeats', async () => {
    for (let i = 1; i <= 5; i++) await repo.record(entry(i));
    const p1 = await repo.list({ limit: 2 });
    expect(p1.items.map((e) => e.id)).toEqual(['aud_005', 'aud_004']);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await repo.list({ limit: 2, cursor: p1.nextCursor! });
    expect(p2.items.map((e) => e.id)).toEqual(['aud_003', 'aud_002']);
    const p3 = await repo.list({ limit: 2, cursor: p2.nextCursor! });
    expect(p3.items.map((e) => e.id)).toEqual(['aud_001']);
    expect(p3.nextCursor).toBeNull();
  });

  it('breaks created_at ties by id descending', async () => {
    const t = '2026-01-01T00:00:00.000Z';
    await repo.record(entry(1, { id: 'aud_a', createdAt: t }));
    await repo.record(entry(2, { id: 'aud_b', createdAt: t }));
    await repo.record(entry(3, { id: 'aud_c', createdAt: t }));
    const p1 = await repo.list({ limit: 2 });
    expect(p1.items.map((e) => e.id)).toEqual(['aud_c', 'aud_b']);
    const p2 = await repo.list({ limit: 2, cursor: p1.nextCursor! });
    expect(p2.items.map((e) => e.id)).toEqual(['aud_a']);
  });

  it('filters by action, restaurantId, actorUserId and the inclusive from/to range', async () => {
    await repo.record(entry(1, { action: 'restaurant.create' }));
    await repo.record(entry(2, { action: 'user.create', targetType: 'user', restaurantId: 'rest_2', actorUserId: 'usr_2' }));
    await repo.record(entry(3, { action: 'user.delete', targetType: 'user', restaurantId: null }));
    expect((await repo.list({ limit: 10, action: 'user.create' })).items.map((e) => e.id)).toEqual(['aud_002']);
    expect((await repo.list({ limit: 10, restaurantId: 'rest_2' })).items.map((e) => e.id)).toEqual(['aud_002']);
    expect((await repo.list({ limit: 10, actorUserId: 'usr_1' })).items.map((e) => e.id)).toEqual(['aud_003', 'aud_001']);
    const range = await repo.list({ limit: 10, from: entry(2).createdAt, to: entry(3).createdAt });
    expect(range.items.map((e) => e.id)).toEqual(['aud_003', 'aud_002']);
  });

  it('returns copies so callers cannot mutate history', async () => {
    await repo.record(entry(1, { details: { a: 1 } }));
    const page = await repo.list({ limit: 10 });
    (page.items[0].details as any).a = 99;
    page.items[0].targetLabel = 'tampered';
    const again = await repo.list({ limit: 10 });
    expect(again.items[0].details).toEqual({ a: 1 });
    expect(again.items[0].targetLabel).toBe('Rest');
  });
});
