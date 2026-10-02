import {
  RestaurantTemplateSummary,
  listRestaurantTemplateSummaries,
} from '../../domain/templates/restaurantTemplates.js';

/** The templates a super admin can pick at creation, derived from the template data. */
export class ListRestaurantTemplatesUseCase {
  execute(): RestaurantTemplateSummary[] {
    return listRestaurantTemplateSummaries();
  }
}
