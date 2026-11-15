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

// delivery-pickup-orders T1 (S1-S3, F1): orderType is persisted state, so every
// read copy and every write-back of the in-memory driver must carry it. A lost
// orderType silently re-prices a pickup order as a delivery.
describe('InMemoryOrderRepository preserves orderType', () => {
  const pickupOrder = () =>
    new Order(
      'ord-pick',
      'rest-z',
      undefined,
      [],
      'pending',
      new Date(),
      0,
      7002,
      'Efectivo',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'recoger'
    );

  it('returns orderType recoger from findById', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(pickupOrder());

    const found = await repo.findById('ord-pick', 'rest-z');

    expect(found?.orderType).toBe('recoger');
  });

  it('keeps orderType recoger after updateStatus writes the order back', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(pickupOrder());

    await repo.updateStatus('ord-pick', 'cooking', 'rest-z');

    expect((await repo.findById('ord-pick', 'rest-z'))?.orderType).toBe('recoger');
  });

  it('keeps orderType recoger after updateReceipt writes the order back', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(pickupOrder());

    await repo.updateReceipt('ord-pick', 'https://example.com/receipt.webp', 'rest-z');

    expect((await repo.findById('ord-pick', 'rest-z'))?.orderType).toBe('recoger');
  });

  it('keeps orderType recoger after an edit (update) and in its return value', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(pickupOrder());

    const snapshot = (await repo.findById('ord-pick', 'rest-z'))!;
    snapshot.comment = 'sin cebolla';
    const updated = await repo.update(snapshot, 'rest-z');

    expect(updated.orderType).toBe('recoger');
    expect((await repo.findById('ord-pick', 'rest-z'))?.orderType).toBe('recoger');
  });

  it('still defaults a legacy order without orderType to domicilio across a write-back', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(new Order('ord-del', 'rest-z', undefined, [], 'pending', new Date(), 2500, 7003));

    await repo.updateStatus('ord-del', 'cooking', 'rest-z');

    const persisted = await repo.findById('ord-del', 'rest-z');
    expect(persisted?.orderType).toBe('domicilio');
    expect(persisted?.deliveryFee).toBe(2500);
  });
});
