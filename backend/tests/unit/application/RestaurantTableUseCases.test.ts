import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRestaurantTableRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantTableRepository.js';
import { ListRestaurantTablesUseCase } from '../../../src/application/use-cases/ListRestaurantTablesUseCase.js';
import { CreateRestaurantTableUseCase } from '../../../src/application/use-cases/CreateRestaurantTableUseCase.js';
import { BulkCreateRestaurantTablesUseCase } from '../../../src/application/use-cases/BulkCreateRestaurantTablesUseCase.js';
import { UpdateRestaurantTableUseCase } from '../../../src/application/use-cases/UpdateRestaurantTableUseCase.js';
import { DeleteRestaurantTableUseCase } from '../../../src/application/use-cases/DeleteRestaurantTableUseCase.js';
import { ReorderRestaurantTablesUseCase } from '../../../src/application/use-cases/ReorderRestaurantTablesUseCase.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

describe('restaurant table use cases', () => {
  let repo: InMemoryRestaurantTableRepository;
  let list: ListRestaurantTablesUseCase;
  let create: CreateRestaurantTableUseCase;
  let bulk: BulkCreateRestaurantTablesUseCase;
  let update: UpdateRestaurantTableUseCase;
  let remove: DeleteRestaurantTableUseCase;
  let reorder: ReorderRestaurantTablesUseCase;

  beforeEach(() => {
    repo = new InMemoryRestaurantTableRepository();
    list = new ListRestaurantTablesUseCase(repo);
    create = new CreateRestaurantTableUseCase(repo);
    bulk = new BulkCreateRestaurantTablesUseCase(repo);
    update = new UpdateRestaurantTableUseCase(repo);
    remove = new DeleteRestaurantTableUseCase(repo);
    reorder = new ReorderRestaurantTablesUseCase(repo);
  });

  describe('create', () => {
    it('creates an active table with a tbl_ id, normalized zone, derived name and the next sort order', async () => {
      const a = await create.execute('rest-1', { zone: '  terraza  ', number: 1 });
      const b = await create.execute('rest-1', { zone: 'Mesa', number: 2 });

      expect(a.id).toMatch(/^tbl_[0-9a-f-]{36}$/);
      expect(a).toMatchObject({
        restaurantId: 'rest-1',
        zone: 'Terraza',
        number: 1,
        alias: null,
        name: 'Terraza 1',
        isActive: true,
        sortOrder: 0,
      });
      expect(b.sortOrder).toBe(1);
    });

    it('derives the name with the alias', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 4, alias: ' Ventana ' });
      expect(t).toMatchObject({ alias: 'Ventana', name: 'Mesa 4 · Ventana' });
    });

    it('treats a blank alias as no alias', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 4, alias: '   ' });
      expect(t.alias).toBeNull();
      expect(t.name).toBe('Mesa 4');
    });

    it('rejects an empty zone, an out-of-range number and a too long alias, in Spanish', async () => {
      await expect(create.execute('rest-1', { zone: '   ', number: 1 })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute('rest-1', { zone: '  ', number: 1 })).rejects.toThrow('La zona de la mesa es obligatoria');
      await expect(create.execute('rest-1', { zone: 'x'.repeat(31), number: 1 })).rejects.toThrow('La zona no puede superar 30 caracteres');
      await expect(create.execute('rest-1', { zone: 'Mesa', number: 0 })).rejects.toThrow('El número de mesa debe estar entre 1 y 9999');
      await expect(create.execute('rest-1', { zone: 'Mesa', number: 10000 })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute('rest-1', { zone: 'Mesa', number: 1.5 })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute('rest-1', { zone: 'Mesa', number: 1, alias: 'x'.repeat(31) })).rejects.toThrow(
        'El alias no puede superar 30 caracteres'
      );
    });

    it('rejects a duplicate (zone, number) ignoring case and spacing, but allows it in another restaurant or zone', async () => {
      await create.execute('rest-1', { zone: 'Terraza', number: 5 });

      await expect(create.execute('rest-1', { zone: 'terraza', number: 5 })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute('rest-1', { zone: ' TERRAZA ', number: 5, alias: 'otra' })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute('rest-2', { zone: 'Terraza', number: 5 })).resolves.toMatchObject({ restaurantId: 'rest-2' });
      await expect(create.execute('rest-1', { zone: 'Salón', number: 5 })).resolves.toMatchObject({ zone: 'Salón' });
      await expect(create.execute('rest-1', { zone: 'Terraza', number: 6 })).resolves.toMatchObject({ number: 6 });
    });

    it('reports a duplicate in Spanish', async () => {
      await create.execute('rest-1', { zone: 'Terraza', number: 5 });
      await expect(create.execute('rest-1', { zone: 'terraza', number: 5 })).rejects.toThrow("Ya existe la mesa 'Terraza 5'");
    });

    it('rejects an invalid explicit id', async () => {
      await expect(create.execute('rest-1', { zone: 'Mesa', number: 1, id: 'bad id!' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('bulk create', () => {
    it('creates the whole range in order with consecutive sort orders', async () => {
      await create.execute('rest-1', { zone: 'Mesa', number: 1 });

      const { created, skipped } = await bulk.execute('rest-1', { zone: 'terraza', from: 1, to: 3 });

      expect(skipped).toEqual([]);
      expect(created.map((t) => t.name)).toEqual(['Terraza 1', 'Terraza 2', 'Terraza 3']);
      expect(created.map((t) => t.sortOrder)).toEqual([1, 2, 3]);
      expect(created.every((t) => t.isActive && t.alias === null && t.restaurantId === 'rest-1')).toBe(true);
      expect((await list.execute('rest-1')).map((t) => t.name)).toEqual(['Mesa 1', 'Terraza 1', 'Terraza 2', 'Terraza 3']);
    });

    it('skips numbers that already exist in the zone (case-insensitive) and reports them', async () => {
      await create.execute('rest-1', { zone: 'Terraza', number: 2 });
      await create.execute('rest-1', { zone: 'Salón', number: 3 });

      const { created, skipped } = await bulk.execute('rest-1', { zone: 'TERRAZA', from: 1, to: 3 });

      expect(skipped).toEqual([2]);
      expect(created.map((t) => t.name)).toEqual(['TERRAZA 1', 'TERRAZA 3']);
    });

    it('creates nothing and returns every number as skipped when all exist', async () => {
      await bulk.execute('rest-1', { zone: 'Mesa', from: 1, to: 2 });
      const again = await bulk.execute('rest-1', { zone: 'Mesa', from: 1, to: 2 });
      expect(again).toEqual({ created: [], skipped: [1, 2] });
    });

    it('honors isActive and keeps restaurants independent', async () => {
      const r = await bulk.execute('rest-2', { zone: 'Mesa', from: 1, to: 2, isActive: false });
      expect(r.created.every((t) => t.isActive === false)).toBe(true);
      expect((await bulk.execute('rest-1', { zone: 'Mesa', from: 1, to: 2 })).skipped).toEqual([]);
    });

    it('accepts exactly 100 tables and rejects 101, from > to and out-of-range numbers', async () => {
      expect((await bulk.execute('rest-1', { zone: 'Mesa', from: 1, to: 100 })).created).toHaveLength(100);
      await expect(bulk.execute('rest-1', { zone: 'Otra', from: 1, to: 101 })).rejects.toThrow(
        'No se pueden crear más de 100 mesas a la vez'
      );
      await expect(bulk.execute('rest-1', { zone: 'Otra', from: 5, to: 4 })).rejects.toBeInstanceOf(ValidationError);
      await expect(bulk.execute('rest-1', { zone: 'Otra', from: 0, to: 4 })).rejects.toBeInstanceOf(ValidationError);
      await expect(bulk.execute('rest-1', { zone: 'Otra', from: 9990, to: 10000 })).rejects.toBeInstanceOf(ValidationError);
      await expect(bulk.execute('rest-1', { zone: '  ', from: 1, to: 2 })).rejects.toBeInstanceOf(ValidationError);
    });

    it('is atomic: a conflict raised while saving leaves no table of the batch behind', async () => {
      const original = repo.saveMany.bind(repo);
      repo.saveMany = async (tables) => {
        // A concurrent request created Mesa 2 between the existence check and the insert.
        await repo.save({ ...tables[1], id: 'tbl_concurrent' });
        return original(tables);
      };

      await expect(bulk.execute('rest-1', { zone: 'Mesa', from: 1, to: 3 })).rejects.toBeInstanceOf(ConflictError);
      expect((await list.execute('rest-1')).map((t) => t.name)).toEqual(['Mesa 2']);
    });
  });

  describe('list', () => {
    it('returns only the restaurant tables ordered by sort order', async () => {
      await create.execute('rest-1', { zone: 'B', number: 1 });
      await create.execute('rest-1', { zone: 'A', number: 1 });
      await create.execute('rest-2', { zone: 'Other', number: 1 });

      const tables = await list.execute('rest-1');

      expect(tables.map((t) => t.name)).toEqual(['B 1', 'A 1']);
    });

    it('breaks sort order ties by zone then number', async () => {
      await repo.saveMany([
        { id: 't1', restaurantId: 'rest-1', zone: 'Terraza', number: 10, alias: null, name: 'Terraza 10', sortOrder: 0, isActive: true, createdAt: '', updatedAt: '' },
        { id: 't2', restaurantId: 'rest-1', zone: 'Terraza', number: 2, alias: null, name: 'Terraza 2', sortOrder: 0, isActive: true, createdAt: '', updatedAt: '' },
        { id: 't3', restaurantId: 'rest-1', zone: 'mesa', number: 9, alias: null, name: 'mesa 9', sortOrder: 0, isActive: true, createdAt: '', updatedAt: '' },
      ]);
      expect((await list.execute('rest-1')).map((t) => t.name)).toEqual(['mesa 9', 'Terraza 2', 'Terraza 10']);
    });
  });

  describe('update', () => {
    it('changes zone, number and alias, recomputes the name and toggles active', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1 });

      const edited = await update.execute(t.id, 'rest-1', { zone: ' terraza ', number: 7, alias: 'Barra', isActive: false });

      expect(edited).toMatchObject({ zone: 'Terraza', number: 7, alias: 'Barra', name: 'Terraza 7 · Barra', isActive: false });
      expect((await repo.findById(t.id, 'rest-1'))?.name).toBe('Terraza 7 · Barra');
    });

    it('keeps untouched fields, clears the alias with null and keeps it with undefined', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1, alias: 'VIP' });

      const same = await update.execute(t.id, 'rest-1', { isActive: false });
      expect(same).toMatchObject({ zone: 'Mesa', number: 1, alias: 'VIP', name: 'Mesa 1 · VIP' });

      const cleared = await update.execute(t.id, 'rest-1', { alias: null });
      expect(cleared).toMatchObject({ alias: null, name: 'Mesa 1' });
    });

    it('saving a table with its own zone and number is not a conflict', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1 });
      await expect(update.execute(t.id, 'rest-1', { zone: 'mesa', number: 1, alias: 'x' })).resolves.toMatchObject({ name: 'Mesa 1 · x' });
    });

    it('rejects invalid values and moving onto another table (zone, number)', async () => {
      const a = await create.execute('rest-1', { zone: 'Mesa', number: 1 });
      await create.execute('rest-1', { zone: 'Mesa', number: 2 });

      await expect(update.execute(a.id, 'rest-1', { zone: '' })).rejects.toBeInstanceOf(ValidationError);
      await expect(update.execute(a.id, 'rest-1', { number: 0 })).rejects.toBeInstanceOf(ValidationError);
      await expect(update.execute(a.id, 'rest-1', { number: 2 })).rejects.toThrow("Ya existe la mesa 'Mesa 2'");
      await expect(update.execute(a.id, 'rest-1', { zone: 'MESA', number: 2 })).rejects.toBeInstanceOf(ConflictError);
    });

    it('reports a missing table in Spanish', async () => {
      await expect(update.execute('nope', 'rest-1', { number: 3 })).rejects.toThrow('Mesa no encontrada.');
      await expect(remove.execute('nope', 'rest-1')).rejects.toThrow('Mesa no encontrada.');
    });

    it('is not found for a table of another restaurant (cross-tenant)', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1 });

      await expect(update.execute(t.id, 'rest-2', { zone: 'Hacked' })).rejects.toBeInstanceOf(EntityNotFoundError);
      expect((await repo.findById(t.id, 'rest-1'))?.name).toBe('Mesa 1');
    });
  });

  describe('delete', () => {
    it('removes the table', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1 });
      await remove.execute(t.id, 'rest-1');
      expect(await repo.findById(t.id, 'rest-1')).toBeNull();
    });

    it('is not found for a table of another restaurant and leaves it untouched', async () => {
      const t = await create.execute('rest-1', { zone: 'Mesa', number: 1 });

      await expect(remove.execute(t.id, 'rest-2')).rejects.toBeInstanceOf(EntityNotFoundError);
      expect(await repo.findById(t.id, 'rest-1')).not.toBeNull();
    });
  });

  describe('reorder', () => {
    it('assigns consecutive sort orders following the given ids', async () => {
      const a = await create.execute('rest-1', { zone: 'A', number: 1 });
      const b = await create.execute('rest-1', { zone: 'B', number: 1 });
      const c = await create.execute('rest-1', { zone: 'C', number: 1 });

      const result = await reorder.execute('rest-1', [c.id, a.id, b.id]);

      expect(result.map((t) => t.name)).toEqual(['C 1', 'A 1', 'B 1']);
      expect((await list.execute('rest-1')).map((t) => t.name)).toEqual(['C 1', 'A 1', 'B 1']);
    });

    it('rejects ids that are unknown, duplicated, or from another restaurant', async () => {
      const a = await create.execute('rest-1', { zone: 'A', number: 1 });
      const foreign = await create.execute('rest-2', { zone: 'F', number: 1 });

      await expect(reorder.execute('rest-1', [a.id, foreign.id])).rejects.toBeInstanceOf(ValidationError);
      await expect(reorder.execute('rest-1', [a.id, a.id])).rejects.toBeInstanceOf(ValidationError);
      await expect(reorder.execute('rest-1', ['tbl_missing'])).rejects.toBeInstanceOf(ValidationError);
    });

    it('keeps tables that were not listed after the listed ones', async () => {
      const a = await create.execute('rest-1', { zone: 'A', number: 1 });
      const b = await create.execute('rest-1', { zone: 'B', number: 1 });
      const c = await create.execute('rest-1', { zone: 'C', number: 1 });

      const result = await reorder.execute('rest-1', [c.id]);

      expect(result.map((t) => t.name)).toEqual(['C 1', 'A 1', 'B 1']);
      expect(a.id).not.toBe(b.id);
    });
  });
});
