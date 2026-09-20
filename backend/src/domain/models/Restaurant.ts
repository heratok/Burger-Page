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
  openingHours: OpeningHours;
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
