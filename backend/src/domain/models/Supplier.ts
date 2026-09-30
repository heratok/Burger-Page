export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
