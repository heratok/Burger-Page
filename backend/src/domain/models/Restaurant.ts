import type { WeeklySchedule } from '@burger-page/contracts';

/** Legacy single-range view, derived from the weekly schedule (read-only). */
export interface OpeningHours {
  open: string;
  close: string;
}

export interface Restaurant {
  id: string;
  slug?: string;
  name: string;
  tagline?: string;
  whatsappNumber?: string;
  adminPassword?: string;
  primaryColor?: string;
  theme: string;
  deliveryFee?: number;
  minOrderAmount?: number;
  config?: any;
  /** Weekly opening ranges in `timezone`; a weekday with no range is closed. */
  schedule: WeeklySchedule;
  /** IANA timezone the schedule is read in. */
  timezone: string;
  /** Manual switch: the storefront stops taking orders regardless of the schedule. */
  ordersPaused: boolean;
  /** Derived from `schedule` (today's first range); undefined when it is empty. */
  openingHours?: OpeningHours;
  isActive: boolean;
  categories?: string[];
  createdAt?: string;
}

/**
 * SUS-20: the one-time admin password is a secret that legitimately appears
 * ONLY in the 201 create response. Read paths (list/get/update) must redact
 * it from the payload even when the repository still holds it (in-memory
 * adapters, future regressions). The domain type keeps the optional field
 * because create still needs it as input and one-time output.
 */
export function omitAdminPassword(restaurant: Restaurant): Restaurant {
  const { adminPassword: _oneTimeSecret, ...redacted } = restaurant;
  return redacted;
}

/** A soft-deleted tenant as shown in the super admin recovery list. */
export interface DeletedRestaurant {
  id: string;
  name: string;
  /** The slug the tenant had before it was deleted (the stored one is renamed). */
  slug: string;
  deletedAt: string;
}
