import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRestaurantTableRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantTableRepository.js';
import { ListRestaurantTablesUseCase } from '../../../src/application/use-cases/ListRestaurantTablesUseCase.js';
import { CreateRestaurantTableUseCase } from '../../../src/application/use-cases/CreateRestaurantTableUseCase.js';
import { UpdateRestaurantTableUseCase } from '../../../src/application/use-cases/UpdateRestaurantTableUseCase.js';
import { DeleteRestaurantTableUseCase } from '../../../src/application/use-cases/DeleteRestaurantTableUseCase.js';
import { ReorderRestaurantTablesUseCase } from '../../../src/application/use-cases/ReorderRestaurantTablesUseCase.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

describe('restaurant table use cases', () => {
  let repo: InMemoryRestaurantTableRepository;
  let list: ListRestaurantTablesUseCase;
  let create: CreateRestaurantTableUseCase;
  let update: UpdateRestaurantTableUseCase;
  let remove: DeleteRestaurantTableUseCase;
  let reorder: ReorderRestaurantTablesUseCase;

  beforeEach(() => {
    repo = new InMemoryRestaurantTableRepository();
    list = new ListRestaurantTablesUseCase(repo);
    create = new CreateRestaurantTableUseCase(repo);
    update = new UpdateRestaurantTableUseCase(repo);
    remove = new DeleteRestaurantTableUseCase(repo);
    reorder = new ReorderRestaurantTablesUseCase(repo);
  });

  describe('create', () => {
    it('creates an active table with a tbl_ id, trimmed name and the next sort order', async () => {
      const a = await create.execute('rest-1', { name: '  Mesa 1  ' });
      const b = await create.execute('rest-1', { name: 'Mesa 2' });

      expect(a.id).toMatch(/^tbl_[0-9a-f-]{36}$/);
      expect(a).toMatchObject({ restaurantId: 'rest-1', name: 'Mesa 1', isActive: true, sortOrder: 0 });
      expect(b.sortOrder).toBe(1);
    });

    it('rejects an empty or blank name', async () => {
      await expect(create.execute('rest-1', { name: '   ' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a name longer than 40 characters', async () => {
      await expect(create.execute('rest-1', { name: 'x'.repeat(41) })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a duplicate name in the same restaurant ignoring case, but allows it in another restaurant', async () => {
      await create.execute('rest-1', { name: 'Mesa 1' });

      await expect(create.execute('rest-1', { name: 'mesa 1' })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute('rest-2', { name: 'Mesa 1' })).resolves.toMatchObject({ restaurantId: 'rest-2' });
    });

    it('rejects an invalid explicit id', async () => {
      await expect(create.execute('rest-1', { name: 'Mesa 1', id: 'bad id!' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('list', () => {
    it('returns only the restaurant tables ordered by sort order', async () => {
      await create.execute('rest-1', { name: 'B' });
      await create.execute('rest-1', { name: 'A' });
      await create.execute('rest-2', { name: 'Other' });

      const tables = await list.execute('rest-1');

      expect(tables.map((t) => t.name)).toEqual(['B', 'A']);
    });
  });

  describe('update', () => {
    it('renames and toggles active', async () => {
      const t = await create.execute('rest-1', { name: 'Mesa 1' });

      const renamed = await update.execute(t.id, 'rest-1', { name: ' Terraza 1 ', isActive: false });

      expect(renamed).toMatchObject({ name: 'Terraza 1', isActive: false });
      expect((await repo.findById(t.id, 'rest-1'))?.name).toBe('Terraza 1');
    });

    it('rejects renaming to an empty name or to another table name', async () => {
      const a = await create.execute('rest-1', { name: 'Mesa 1' });
      await create.execute('rest-1', { name: 'Mesa 2' });

      await expect(update.execute(a.id, 'rest-1', { name: '' })).rejects.toBeInstanceOf(ValidationError);
      await expect(update.execute(a.id, 'rest-1', { name: 'MESA 2' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('is not found for a table of another restaurant (cross-tenant)', async () => {
      const t = await create.execute('rest-1', { name: 'Mesa 1' });

      await expect(update.execute(t.id, 'rest-2', { name: 'Hacked' })).rejects.toBeInstanceOf(EntityNotFoundError);
      expect((await repo.findById(t.id, 'rest-1'))?.name).toBe('Mesa 1');
    });
  });

  describe('delete', () => {
    it('removes the table', async () => {
      const t = await create.execute('rest-1', { name: 'Mesa 1' });
      await remove.execute(t.id, 'rest-1');
      expect(await repo.findById(t.id, 'rest-1')).toBeNull();
    });

    it('is not found for a table of another restaurant and leaves it untouched', async () => {
      const t = await create.execute('rest-1', { name: 'Mesa 1' });

      await expect(remove.execute(t.id, 'rest-2')).rejects.toBeInstanceOf(EntityNotFoundError);
      expect(await repo.findById(t.id, 'rest-1')).not.toBeNull();
    });
  });

  describe('reorder', () => {
    it('assigns consecutive sort orders following the given ids', async () => {
      const a = await create.execute('rest-1', { name: 'A' });
      const b = await create.execute('rest-1', { name: 'B' });
      const c = await create.execute('rest-1', { name: 'C' });

      const result = await reorder.execute('rest-1', [c.id, a.id, b.id]);

      expect(result.map((t) => t.name)).toEqual(['C', 'A', 'B']);
      expect((await list.execute('rest-1')).map((t) => t.name)).toEqual(['C', 'A', 'B']);
    });

    it('rejects ids that are unknown, duplicated, or from another restaurant', async () => {
      const a = await create.execute('rest-1', { name: 'A' });
      const foreign = await create.execute('rest-2', { name: 'F' });

      await expect(reorder.execute('rest-1', [a.id, foreign.id])).rejects.toBeInstanceOf(ValidationError);
      await expect(reorder.execute('rest-1', [a.id, a.id])).rejects.toBeInstanceOf(ValidationError);
      await expect(reorder.execute('rest-1', ['tbl_missing'])).rejects.toBeInstanceOf(ValidationError);
    });

    it('keeps tables that were not listed after the listed ones', async () => {
      const a = await create.execute('rest-1', { name: 'A' });
      const b = await create.execute('rest-1', { name: 'B' });
      const c = await create.execute('rest-1', { name: 'C' });

      const result = await reorder.execute('rest-1', [c.id]);

      expect(result.map((t) => t.name)).toEqual(['C', 'A', 'B']);
      expect(a.id).not.toBe(b.id);
    });
  });
});
