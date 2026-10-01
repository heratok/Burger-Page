import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const srcDir = resolve(__dirname, '../../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

const files = walk(srcDir).map((full) => ({
  rel: relative(srcDir, full).split(sep).join('/'),
  text: readFileSync(full, 'utf8'),
}));

describe('entity ids come from the single generator (db-hardening-0008 T11)', () => {
  it('no source file builds entity ids with randomUUID (storage object names are the only exception)', () => {
    const offenders = files
      .filter((f) => /\brandomUUID\b/.test(f.text))
      .map((f) => f.rel)
      .filter((rel) => rel !== 'infrastructure/http/routes/storage.routes.ts');
    expect(offenders).toEqual([]);
  });

  it('no id is assembled from Date.now() and random bytes', () => {
    const offenders = files.filter((f) => /\$\{Date\.now\(\)\}_\$\{randomBytes/.test(f.text)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('use cases and repositories that mint ids import newId', () => {
    for (const rel of [
      'application/use-cases/CreateProductUseCase.ts',
      'application/use-cases/CreateCustomerUseCase.ts',
      'application/use-cases/CreateOrderUseCase.ts',
      'application/use-cases/CreateSupplierUseCase.ts',
      'application/use-cases/CreateRestaurantUseCase.ts',
      'application/use-cases/CreateUserUseCase.ts',
      'application/use-cases/CreateInventoryItemUseCase.ts',
      'application/use-cases/CreateProductAdditionUseCase.ts',
      'infrastructure/persistence/postgres/PgOrderRepository.ts',
      'scripts/createAdmin.ts',
    ]) {
      expect(files.find((f) => f.rel === rel)!.text, rel).toMatch(/shared\/newId\.js/);
    }
  });
});
