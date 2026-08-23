export class Customer {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public phone: string,
    public totalSpend: number = 0,
    public totalOrders: number = 0
  ) {}

  public get loyaltyTier(): string {
    if (this.totalSpend > 500) return 'Gold';
    if (this.totalSpend > 200) return 'Silver';
    return 'Bronze';
  }

  public addOrderSpend(amount: number): void {
    this.totalSpend += amount;
    this.totalOrders += 1;
  }
}
