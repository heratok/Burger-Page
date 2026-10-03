import { randomBytes } from 'node:crypto';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { RestaurantProvisioning, SeededIds } from '../services/RestaurantProvisioning.js';
import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { MIN_PASSWORD_LENGTH, User, UserRole } from '../../domain/models/User.js';
import { CreateRestaurantInput } from '@burger-page/contracts';
import { ConflictError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { normalizeSlug } from '../../domain/shared/slug.js';
import { DEFAULT_CURRENCY_SYMBOL, defaultSymbolFor, normalizeCurrency } from '../../domain/shared/currency.js';
import {
  SUPPORTED_TEMPLATE_CURRENCIES,
  getRestaurantTemplate,
  isTemplateCurrencySupported,
  templateSeedsSampleData,
} from '../../domain/templates/restaurantTemplates.js';
import {
  DEFAULT_TIMEZONE,
  assertValidSchedule,
  assertValidTimezone,
  defaultWeeklySchedule,
  legacyOpeningHours,
  scheduleFromLegacyHoursText,
} from '../../domain/shared/restaurantSchedule.js';

export class CreateRestaurantUseCase {
  private readonly provisioning: RestaurantProvisioning;

  constructor(
    private readonly restaurantRepo: RestaurantRepository,
    private readonly categoryRepo?: CategoryRepository,
    private readonly userRepo?: UserRepository,
    private readonly hasher?: PasswordHasher,
    // Needed to seed the sample dishes of a template. Without them a template
    // only picks the theme (script/test callers that wire a bare use case).
    private readonly productRepo?: ProductRepository,
    private readonly additionRepo?: ProductAdditionRepository,
    private readonly audit?: AdminAuditRecorder
  ) {
    this.provisioning = new RestaurantProvisioning(restaurantRepo, categoryRepo, productRepo, additionRepo);
  }

  async execute(input: CreateRestaurantInput, callerRole?: UserRole, actor?: AuditActor): Promise<Restaurant> {
    const cleanSlug = normalizeSlug(input.slug);

    const name = input.name.trim();
    if (!name) throw new ValidationError('Restaurant name is required');

    // slugExists, not findBySlug: the latter is the public lookup and cannot see
    // a paused tenant, which would let the unique index answer with a 500.
    if (await this.restaurantRepo.slugExists(cleanSlug)) {
      throw new ConflictError(`Restaurant with slug "${cleanSlug}" already exists`);
    }

    if (input.adminPassword !== undefined && input.adminPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // SUS-02: a tenant is only usable when its admin user exists, so the
    // username is checked BEFORE anything is written. JD-B-001: a colliding
    // adminUsername (e.g. the seeded super admin 'admin') must never reach
    // userRepo.save — the Pg driver upserts by username OR id and would rewrite
    // the existing user's password_hash/role/restaurant_id.
    const adminUsername = input.adminUsername?.trim() || `admin_${cleanSlug}`;
    if (this.userRepo && (await this.userRepo.findByUsername(adminUsername))) {
      throw new ConflictError(`Username "${adminUsername}" already exists`);
    }

    // The weekly schedule is the stored source of the hours: an explicit one
    // wins, then a legacy "HH:MM - HH:MM" config text, then the default.
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    assertValidTimezone(timezone);
    if (input.schedule !== undefined) assertValidSchedule(input.schedule);

    // Unknown ids cannot get past the contract, but a direct caller could send
    // one: fail before writing anything instead of silently creating a blank shop.
    const template = input.templateType ? getRestaurantTemplate(input.templateType) : undefined;
    if (input.templateType && !template) {
      throw new ValidationError(`Unknown restaurant template "${input.templateType}"`);
    }

    // Money of the store (restaurant_settings). Omitted means COP / "$"; a
    // currency sent without a symbol gets the usual symbol for that code.
    const currency = normalizeCurrency(input.currency ?? input.config?.currency);
    // Sample prices are declared in COP and scaled: a currency without a known
    // scale would seed COP-sized numbers, so it is refused up front.
    if (template && templateSeedsSampleData(template) && !isTemplateCurrencySupported(currency)) {
      throw new ValidationError(
        `The "${template.id}" template cannot price sample dishes in ${currency}. Supported currencies: ${SUPPORTED_TEMPLATE_CURRENCIES.join(', ')}. Use the blank template or one of those currencies.`
      );
    }
    const currencySymbol =
      input.currencySymbol ??
      input.config?.currencySymbol ??
      (input.currency || input.config?.currency ? defaultSymbolFor(currency) : DEFAULT_CURRENCY_SYMBOL);
    const schedule =
      input.schedule ?? scheduleFromLegacyHoursText(input.config?.openingHours) ?? defaultWeeklySchedule();

    // Server-owned identity: client-supplied ids are never trusted
        // (a malicious or stale id could overwrite an existing tenant via upsert).
        const restaurantId = newId(ID_PREFIX.restaurant);
    // Default admin credentials must never be predictable: generate a random
    // secret when the caller does not provide one. It is returned once in the
    // create response and only its hash (on the admin user) is persisted.
    const adminPassword = input.adminPassword || randomBytes(12).toString('base64url');
    const newRestaurant: Restaurant = {
      id: restaurantId,
      slug: cleanSlug,
      name,
      tagline: input.tagline || 'Cocina artesanal',
      whatsappNumber: input.whatsappNumber || '573001234567',
      primaryColor: input.primaryColor || '#FF7A21',
      theme: input.theme || template?.theme || 'dark-charcoal',
      config: {
        ...(input.config || {
          name,
          tagline: input.tagline || 'Cocina artesanal',
          whatsappNumber: input.whatsappNumber || '573001234567',
          primaryColor: input.primaryColor || '#FF7A21',
          bgTheme: input.theme || 'dark-charcoal',
        }),
        currency,
        currencySymbol,
      },
      schedule,
      timezone,
      ordersPaused: input.ordersPaused ?? false,
      openingHours: legacyOpeningHours(schedule, timezone),
      isActive: true,
      categories: mergeCategoryNames(input.categories ?? [], template?.categories ?? []),
      createdAt: new Date().toISOString(),
    };

    await this.restaurantRepo.save(newRestaurant);

    // A template with sample data seeds every category strictly below; otherwise
    // (no template, or blank) the caller's categories keep the historical
    // best-effort sync.
    const seedsSampleData = !!template && templateSeedsSampleData(template);
    if (!seedsSampleData && this.categoryRepo && newRestaurant.categories?.length) {
      try {
        for (let i = 0; i < newRestaurant.categories.length; i++) {
          await this.categoryRepo.save({
            id: newId(ID_PREFIX.category),
            restaurantId,
            name: newRestaurant.categories[i],
            displayOrder: i,
            isActive: true,
          });
        }
      } catch (err) {
        console.warn('Could not sync initial categories to CategoryRepository:', err);
      }
    }

    // Sample dishes. Not transactional across repositories (each opens its own
    // tenant transaction), so a failure removes what was written, like the
    // admin provisioning below.
    const seeded: SeededIds = { categories: [], products: [], additions: [] };
    if (template && seedsSampleData) {
      try {
        await this.provisioning.seedTemplate(template, newRestaurant.categories ?? [], restaurantId, currency, seeded);
      } catch (err) {
        await this.provisioning.rollbackTenant(restaurantId, seeded);
        throw err;
      }
    }

    // Provision the restaurant_admin row from the one-time credentials we are
    // about to return. The actor role comes from the authenticated caller (the
    // create route is super-admin-gated) and defaults to super_admin for
    // script/test callers that do not authenticate. A failure here must not
    // leave a tenant nobody can log into: undo the tenant and surface the error.
    if (this.userRepo && this.hasher) {
      try {
        const adminUser: User = {
          id: newId(ID_PREFIX.user),
          username: adminUsername,
          passwordHash: await this.hasher.hash(adminPassword),
          role: 'restaurant_admin',
          restaurantId,
          createdAt: new Date().toISOString(),
          isActive: true,
          mustChangePassword: true,
        };
        await this.userRepo.save(adminUser, callerRole ?? 'super_admin');
      } catch (err) {
        await this.provisioning.rollbackTenant(restaurantId, seeded);
        throw err;
      }
    }

    await this.audit?.record(actor, {
      action: 'restaurant.create',
      targetType: 'restaurant',
      targetId: restaurantId,
      targetLabel: newRestaurant.name,
      restaurantId,
      // Never the password: only the admin USERNAME is recorded.
      details: {
        slug: cleanSlug,
        template: template?.id ?? null,
        currency,
        currencySymbol,
        timezone,
        adminUsername: this.userRepo && this.hasher ? adminUsername : null,
      },
    });

    return { ...newRestaurant, adminPassword, adminUsername } as Restaurant;
  }
}

/** Case-insensitive union keeping the first spelling and the template order first. */
function mergeCategoryNames(primary: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...primary, ...extra]) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
