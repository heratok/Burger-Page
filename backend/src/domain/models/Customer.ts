export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'vip';

export class Customer {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public phone: string,
    public totalSpent: number = 0,
    public totalOrders: number = 0
  ) {}

  public get totalSpend(): number {
    return this.totalSpent;
  }

  public set totalSpend(val: number) {
    this.totalSpent = val;
  }

  public get loyaltyTier(): LoyaltyTier {
    if (this.totalSpent >= 400000 || this.totalOrders >= 10) return 'vip';
    if (this.totalSpent >= 250000 || this.totalOrders >= 6) return 'gold';
    if (this.totalSpent >= 100000 || this.totalOrders >= 3) return 'silver';
    return 'bronze';
  }

  public addOrderSpend(amount: number): void {
    this.totalSpent += amount;
    this.totalOrders += 1;
  }
}
