import { describe, it, expect, vi } from 'vitest';
import { AdminAuditRecorder } from '../../../src/application/services/AdminAuditRecorder.js';
import { InMemoryAuditLogRepository } from '../../../src/infrastructure/persistence/InMemoryAuditLogRepository.js';
import { AuditLogRepository } from '../../../src/domain/ports/out/AuditLogRepository.js';

const superAdmin = { userId: 'usr_1', username: 'root', role: 'super_admin' as const };
const event = {
  action: 'restaurant.create' as const,
  targetType: 'restaurant' as const,
  targetId: 'rest_1',
  targetLabel: 'Burger',
  restaurantId: 'rest_1',
  details: { slug: 'burger' },
};

describe('AdminAuditRecorder', () => {
  it('stores actor snapshot, target snapshot and a server-generated id and timestamp', async () => {
    const repo = new InMemoryAuditLogRepository();
    await new AdminAuditRecorder(repo).record(superAdmin, event);
    const [item] = (await repo.list({ limit: 10 })).items;
    expect(item).toMatchObject({
      actorUserId: 'usr_1',
      actorUsername: 'root',
      action: 'restaurant.create',
      targetType: 'restaurant',
      targetId: 'rest_1',
      targetLabel: 'Burger',
      restaurantId: 'rest_1',
      details: { slug: 'burger' },
    });
    expect(item.id).toMatch(/^aud_/);
    expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
  });

  it('sanitizes details before they reach the repository', async () => {
    const repo = new InMemoryAuditLogRepository();
    await new AdminAuditRecorder(repo).record(superAdmin, {
      ...event,
      details: { adminPassword: 'hunter2', temporaryPassword: 'abc', passwordHash: 'x', changedFields: ['adminPassword'] },
    });
    const [item] = (await repo.list({ limit: 10 })).items;
    expect(item.details).toEqual({ changedFields: ['adminPassword'] });
    // The id is a server-generated hex UUID, so it legitimately contains any hex
    // substring, "abc" included. Sanitizing is about every other field.
    const { id: _id, ...persisted } = item;
    expect(JSON.stringify(persisted)).not.toMatch(/hunter2|abc/);
  });

  it('stays green when the generated id happens to contain the sanitized substring', async () => {
    // Regression: ids are hex UUIDs, so about one in a thousand contains "abc" —
    // the same substring as the temporary password below. Scanning the whole
    // entry, server-generated id included, made this suite fail at random.
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((buffer: Uint8Array) => {
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = i % 2 === 0 ? 0xab : 0xc0;
      return buffer;
    }) as typeof globalThis.crypto.getRandomValues);
    try {
      const repo = new InMemoryAuditLogRepository();
      await new AdminAuditRecorder(repo).record(superAdmin, {
        ...event,
        details: { adminPassword: 'hunter2', temporaryPassword: 'abc' },
      });
      const [item] = (await repo.list({ limit: 10 })).items;
      expect(item.id).toContain('abc');
      expect(item.details).toEqual({});
      const { id: _id, ...persisted } = item;
      expect(JSON.stringify(persisted)).not.toMatch(/hunter2|abc/);
    } finally {
      spy.mockRestore();
    }
  });

  it('skips when there is no actor or the actor is not a super admin', async () => {
    const repo = new InMemoryAuditLogRepository();
    const rec = new AdminAuditRecorder(repo);
    await rec.record(undefined, event);
    await rec.record({ userId: 'usr_2', username: 'tenant', role: 'restaurant_admin' }, event);
    expect((await repo.list({ limit: 10 })).items).toEqual([]);
  });

  it('fails open: an audit write error is logged loudly (with the entry) and never thrown', async () => {
    const failing: AuditLogRepository = {
      record: vi.fn().mockRejectedValue(new Error('db down')),
      list: vi.fn(),
    };
    const logger = { error: vi.fn() };
    await expect(new AdminAuditRecorder(failing, logger).record(superAdmin, event)).resolves.toBeUndefined();
    expect(failing.record).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [msg, payload] = logger.error.mock.calls[0];
    expect(msg).toMatch(/AUDIT.*NOT RECORDED/i);
    expect(JSON.stringify(payload)).toContain('restaurant.create');
    expect(JSON.stringify(payload)).toContain('db down');
  });
});
