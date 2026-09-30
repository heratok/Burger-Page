import { describe, it, expect } from 'vitest';
import { InMemoryOrderRepository } from '../../src/infrastructure/persistence/InMemoryOrderRepository.js';
import { Order } from '../../src/domain/models/Order.js';

// Drivers must agree with Postgres: an order EDIT (update) never writes the
// status column; status changes go only through updateStatus (CAS).
describe('InMemoryOrderRepository.update keeps the persisted status (WU-4 alignment)', () => {
  it('does not overwrite a concurrently changed status', async () => {
    const repo = new InMemoryOrderRepository();
    const base = () =>
      new Order('ord-upd', 'rest-z', undefined, [], 'pending', new Date(), 1000, 7001);
    await repo.save(base());

    // Staff screen A loads the order, screen B moves it to cooking meanwhile.
    const stale = (await repo.findById('ord-upd', 'rest-z'))!;
    await repo.updateStatus('ord-upd', 'cooking', 'rest-z');

    stale.deliveryFee = 2500;
    const result = await repo.update(stale, 'rest-z');

    const persisted = await repo.findById('ord-upd', 'rest-z');
    expect(persisted?.deliveryFee).toBe(2500);
    expect(persisted?.status).toBe('cooking');
    expect(result.status).toBe('cooking');
  });
});
