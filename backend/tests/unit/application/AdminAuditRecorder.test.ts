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
    expect(JSON.stringify(item)).not.toMatch(/hunter2|abc/);
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
