import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Permission } from '@burger-page/contracts';
import { requireAnyPermission, requirePermission } from '../../src/infrastructure/http/middleware/auth.middleware.js';

function run(guard: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>, permissions?: Permission[]) {
  const send = vi.fn();
  const reply = { status: vi.fn().mockReturnValue({ send }) } as unknown as FastifyReply;
  const req = {
    authContext: permissions
      ? { userId: 'u', username: 'u', role: 'restaurant_staff', restaurantId: 'r', permissions }
      : undefined,
  } as unknown as FastifyRequest;
  return guard(req, reply).then(() => ({ status: (reply.status as any).mock.calls[0]?.[0] as number | undefined }));
}

describe('requirePermission / requireAnyPermission', () => {
  it('requirePermission needs every listed permission', async () => {
    const guard = requirePermission('orders.manage', 'finance.view');
    expect((await run(guard, ['orders.manage', 'finance.view'])).status).toBeUndefined();
    expect((await run(guard, ['orders.manage'])).status).toBe(403);
    expect((await run(guard, [])).status).toBe(403);
  });

  it('requireAnyPermission needs at least one', async () => {
    const guard = requireAnyPermission('orders.view', 'orders.manage');
    expect((await run(guard, ['orders.manage'])).status).toBeUndefined();
    expect((await run(guard, ['menu.manage'])).status).toBe(403);
  });

  it('both answer 401 when no session was established', async () => {
    expect((await run(requirePermission('orders.view'))).status).toBe(401);
    expect((await run(requireAnyPermission('orders.view'))).status).toBe(401);
  });
});
