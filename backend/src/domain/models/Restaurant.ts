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
  config?: any;
  openingHours: OpeningHours;
  isActive: boolean;
  categories?: string[];
  createdAt?: string;
}
