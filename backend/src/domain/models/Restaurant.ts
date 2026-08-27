export interface OpeningHours {
  open: string;
  close: string;
}

export interface Restaurant {
  id: string;
  slug?: string;
  name: string;
  theme: string;
  openingHours: OpeningHours;
  isActive: boolean;
}
