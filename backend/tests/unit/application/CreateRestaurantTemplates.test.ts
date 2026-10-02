import { describe, it, expect } from 'vitest';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { InMemoryCategoryRepository } from '../../../src/infrastructure/persistence/InMemoryCategoryRepository.js';
import { InMemoryProductRepository } from '../../../src/infrastructure/persistence/InMemoryProductRepository.js';
import { InMemoryProductAdditionRepository } from '../../../src/infrastructure/persistence/InMemoryProductAdditionRepository.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { CryptoPasswordHasher } from '../../../src/infrastructure/security/CryptoPasswordHasher.js';
import { ProductRepository } from '../../../src/domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../../src/domain/ports/out/ProductAdditionRepository.js';
import { getRestaurantTemplate } from '../../../src/domain/templates/restaurantTemplates.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

function build(overrides: { productRepo?: ProductRepository; additionRepo?: ProductAdditionRepository } = {}) {
  const restaurantRepo = new InMemoryRestaurantRepository();
  const categoryRepo = new InMemoryCategoryRepository();
  const productRepo = overrides.productRepo ?? new InMemoryProductRepository();
  const additionRepo = overrides.additionRepo ?? new InMemoryProductAdditionRepository();
  const userRepo = new InMemoryUserRepository();
  const useCase = new CreateRestaurantUseCase(
    restaurantRepo,
    categoryRepo,
    userRepo,
    new CryptoPasswordHasher(),
    productRepo,
    additionRepo
  );
  return { useCase, restaurantRepo, categoryRepo, productRepo, additionRepo, userRepo };
}

describe('CreateRestaurantUseCase - currency and timezone (super-admin-panel B2)', () => {
  it('persists timezone, currency and currencySymbol into the restaurant config', async () => {
    const { useCase, restaurantRepo } = build();
    const created = await useCase.execute({
      name: 'Tacos Mx',
      slug: 'tacos-mx',
      timezone: 'America/Mexico_City',
      currency: 'mxn',
      currencySymbol: 'MX$',
    });

    const stored = await restaurantRepo.findById(created.id);
    expect(stored?.timezone).toBe('America/Mexico_City');
    expect(stored?.config).toMatchObject({ currency: 'MXN', currencySymbol: 'MX$' });
  });

  it('defaults to America/Bogota, COP and $ when omitted', async () => {
    const { useCase, restaurantRepo } = build();
    const created = await useCase.execute({ name: 'Default', slug: 'default-shop' });
    const stored = await restaurantRepo.findById(created.id);
    expect(stored?.timezone).toBe('America/Bogota');
    expect(stored?.config).toMatchObject({ currency: 'COP', currencySymbol: '$' });
  });

  it('keeps the currency when the caller also sends a config object', async () => {
    const { useCase, restaurantRepo } = build();
    const created = await useCase.execute({
      name: 'Con config',
      slug: 'con-config',
      currency: 'USD',
      config: { name: 'Con config', tagline: 'x' },
    });
    const stored = await restaurantRepo.findById(created.id);
    expect(stored?.config).toMatchObject({ currency: 'USD', currencySymbol: '$', tagline: 'x' });
  });

  it('derives a known symbol for a currency sent without one', async () => {
    const { useCase, restaurantRepo } = build();
    const created = await useCase.execute({ name: 'Euro', slug: 'euro-shop', currency: 'EUR' });
    expect((await restaurantRepo.findById(created.id))?.config).toMatchObject({ currency: 'EUR', currencySymbol: '€' });
  });
});

describe('CreateRestaurantUseCase - real templates (super-admin-panel B2)', () => {
  it('burger creates its categories, available products and global additions for the new tenant', async () => {
    const { useCase, categoryRepo, productRepo, additionRepo } = build();
    const template = getRestaurantTemplate('burger')!;
    const created = await useCase.execute({ name: 'Burger Uno', slug: 'burger-uno', templateType: 'burger' });

    const categories = await categoryRepo.findByRestaurantId(created.id);
    const products = await productRepo.findByRestaurantId(created.id);
    const additions = await additionRepo.findByRestaurantId(created.id);

    expect(categories.map((c) => c.name)).toEqual(template.categories);
    expect(products).toHaveLength(template.products.length);
    expect(additions).toHaveLength(template.additions.length);
    expect(created.categories).toEqual(template.categories);

    for (const p of products) {
      expect(p.restaurantId).toBe(created.id);
      expect(p.isAvailable).toBe(true);
      expect(p.price).toBeGreaterThan(0);
      expect(categories.find((c) => c.id === p.categoryId)?.name).toBe(p.category);
    }
    for (const a of additions) {
      expect(a.restaurantId).toBe(created.id);
      expect(a.isAvailable).toBe(true);
      expect(a.productId).toBeUndefined();
    }
  });

  it.each(['pizza', 'tacos'] as const)('%s creates the sample data declared by its template', async (id) => {
    const { useCase, productRepo, additionRepo } = build();
    const template = getRestaurantTemplate(id)!;
    const created = await useCase.execute({ name: `Shop ${id}`, slug: `shop-${id}`, templateType: id });
    expect(await productRepo.findByRestaurantId(created.id)).toHaveLength(template.products.length);
    expect(await additionRepo.findByRestaurantId(created.id)).toHaveLength(template.additions.length);
    expect(template.products.length).toBeGreaterThan(0);
    expect(template.additions.length).toBeGreaterThan(0);
  });

  it('blank (and no template) creates nothing', async () => {
    const { useCase, categoryRepo, productRepo, additionRepo } = build();
    const a = await useCase.execute({ name: 'Blank', slug: 'blank-shop', templateType: 'blank' });
    const b = await useCase.execute({ name: 'Plain', slug: 'plain-shop' });
    for (const r of [a, b]) {
      expect(await categoryRepo.findByRestaurantId(r.id)).toHaveLength(0);
      expect(await productRepo.findByRestaurantId(r.id)).toHaveLength(0);
      expect(await additionRepo.findByRestaurantId(r.id)).toHaveLength(0);
    }
  });

  it('scales sample prices to the chosen currency and never produces a zero price', async () => {
    const { useCase, productRepo } = build();
    const cop = await useCase.execute({ name: 'Cop', slug: 'cop-shop', templateType: 'burger' });
    const usd = await useCase.execute({ name: 'Usd', slug: 'usd-shop', templateType: 'burger', currency: 'USD' });
    const copPrices = (await productRepo.findByRestaurantId(cop.id)).map((p) => p.price);
    const usdPrices = (await productRepo.findByRestaurantId(usd.id)).map((p) => p.price);
    expect(Math.max(...copPrices)).toBeGreaterThan(10000);
    expect(Math.max(...usdPrices)).toBeLessThan(50);
    expect(Math.min(...usdPrices)).toBeGreaterThan(0);
  });

  it('merges caller-provided categories with the template categories without duplicates', async () => {
    const { useCase, categoryRepo } = build();
    const created = await useCase.execute({
      name: 'Merge',
      slug: 'merge-shop',
      templateType: 'burger',
      categories: ['hamburguesas', 'Postres'],
    });
    const names = (await categoryRepo.findByRestaurantId(created.id)).map((c) => c.name);
    expect(names.filter((n) => n.toLowerCase() === 'hamburguesas')).toHaveLength(1);
    expect(names).toEqual(['hamburguesas', 'Postres', 'Acompañamientos', 'Bebidas']);
  });

  it('rolls back the tenant, admin user and every seeded row when a product fails to save', async () => {
    const products = failingOnNthSave(new InMemoryProductRepository(), 3, 'boom');
    const ctx = build({ productRepo: products });
    const categories = recordSaves(ctx.categoryRepo);

    await expect(
      ctx.useCase.execute({ name: 'Falla', slug: 'falla-shop', templateType: 'burger', adminUsername: 'falla_admin' })
    ).rejects.toThrow('boom');

    expect(await ctx.restaurantRepo.findBySlug('falla-shop')).toBeNull();
    expect(await ctx.userRepo.findByUsername('falla_admin')).toBeNull();
    expect(categories.saved.length).toBeGreaterThan(0);
    expect(products.saved.length).toBe(2);
    for (const c of categories.saved) expect(await ctx.categoryRepo.findById(c.id, c.restaurantId)).toBeNull();
    for (const p of products.saved) expect(await products.findById(p.id, p.restaurantId)).toBeNull();
  });

  it('rolls back when an addition fails to save', async () => {
    const additions = failingOnNthSave(new InMemoryProductAdditionRepository(), 2, 'addition boom');
    const ctx = build({ additionRepo: additions });
    const products = recordSaves(ctx.productRepo);

    await expect(ctx.useCase.execute({ name: 'Falla 2', slug: 'falla-dos', templateType: 'pizza' })).rejects.toThrow(
      'addition boom'
    );

    expect(await ctx.restaurantRepo.findBySlug('falla-dos')).toBeNull();
    expect(products.saved.length).toBeGreaterThan(0);
    expect(additions.saved.length).toBe(1);
    for (const p of products.saved) expect(await ctx.productRepo.findById(p.id, p.restaurantId)).toBeNull();
    for (const a of additions.saved) expect(await additions.findById(a.id, a.restaurantId)).toBeNull();
  });

  it('rejects an unknown template id before writing anything', async () => {
    const { useCase, restaurantRepo } = build();
    await expect(useCase.execute({ name: 'X', slug: 'x-shop', templateType: 'sushi' as any })).rejects.toThrow(
      ValidationError
    );
    expect(await restaurantRepo.findBySlug('x-shop')).toBeNull();
  });
});

/** Wraps a repository so every successful save is remembered. */
function recordSaves<T extends { save(entity: any): Promise<void> }>(repo: T): T & { saved: any[] } {
  const saved: any[] = [];
  const original = repo.save.bind(repo);
  (repo as any).save = async (entity: any) => {
    await original(entity);
    saved.push(entity);
  };
  (repo as any).saved = saved;
  return repo as T & { saved: any[] };
}

/** Wraps a repository so its Nth save throws; earlier saves are recorded. */
function failingOnNthSave<T extends { save(entity: any): Promise<void> }>(repo: T, nth: number, message: string) {
  const recorded = recordSaves(repo);
  const save = recorded.save.bind(recorded);
  let calls = 0;
  (recorded as any).save = async (entity: any) => {
    if (++calls === nth) throw new Error(message);
    await save(entity);
  };
  return recorded;
}

describe('CreateRestaurantUseCase - currencies a sample template can price (review B4)', () => {
  it('rejects a sample template with a currency without a price scale, listing the supported ones, and writes nothing', async () => {
    const { useCase, restaurantRepo } = build();
    const before = (await restaurantRepo.findAll()).length;
    const attempt = useCase.execute({ name: 'Yen', slug: 'yen-shop', templateType: 'burger', currency: 'JPY' });
    await expect(attempt).rejects.toThrow(ValidationError);
    await expect(attempt).rejects.toThrow(/JPY.*COP.*USD/s);
    expect((await restaurantRepo.findAll()).length).toBe(before);
  });

  it('accepts any valid currency with the blank template or no template', async () => {
    const { useCase, restaurantRepo } = build();
    const a = await useCase.execute({ name: 'Yen blank', slug: 'yen-blank', templateType: 'blank', currency: 'JPY' });
    const b = await useCase.execute({ name: 'Yen plain', slug: 'yen-plain', currency: 'JPY' });
    expect((await restaurantRepo.findById(a.id))?.config).toMatchObject({ currency: 'JPY' });
    expect((await restaurantRepo.findById(b.id))?.config).toMatchObject({ currency: 'JPY' });
  });

  it('still accepts a listed currency with a sample template', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ name: 'Peso', slug: 'peso-shop', templateType: 'tacos', currency: 'mxn' })
    ).resolves.toBeDefined();
  });
});
