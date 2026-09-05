export class Customer {
  constructor(
    public readonly id: string,
    public readonly restaurantId: string,
    public name: string,
    public phone: string,
    public address: string = '',
    public barrio: string = '',
    public notes: string = '',
    public email: string = '',
    public createdAt?: string,
    public updatedAt?: string
  ) {}
}
