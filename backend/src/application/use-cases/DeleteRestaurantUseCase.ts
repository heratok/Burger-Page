import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class DeleteRestaurantUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(id: string): Promise<void> {
    const existing =
      (await this.restaurantRepo.findById(id)) ?? (await this.restaurantRepo.findBySlug(id));
    if (!existing) {
      throw new EntityNotFoundError(`Restaurant with id or slug "${id}" not found`);
    }
    // Retire the tenant's users first (idempotent): if the soft delete fails
    // the call can simply be retried, and a deleted tenant never keeps live
    // logins or squats on the default admin username.
    await this.userRepo?.retireByRestaurantId(existing.id);
    await this.restaurantRepo.delete(existing.id);
  }
}
