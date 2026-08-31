export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  slug?: string;
  displayOrder?: number;
  isActive?: boolean;
}
