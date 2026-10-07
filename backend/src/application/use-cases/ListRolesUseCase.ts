import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { Role } from '../../domain/models/Role.js';

export class ListRolesUseCase {
  constructor(private roleRepo: RoleRepository) {}

  async execute(restaurantId: string): Promise<Role[]> {
    return this.roleRepo.findByRestaurantId(restaurantId);
  }
}
