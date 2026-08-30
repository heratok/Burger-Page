export class ProductAddition {
  constructor(
    public readonly id: string,
    public readonly restaurantId: string,
    public readonly name: string,
    public readonly price: number,
    public readonly isAvailable: boolean = true,
    public readonly productId?: string,
    public readonly displayOrder: number = 0
  ) {}
}
