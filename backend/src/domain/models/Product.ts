export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  preparationTimeMinutes?: number;
  displayOrder?: number;
  additions?: string[];
}
