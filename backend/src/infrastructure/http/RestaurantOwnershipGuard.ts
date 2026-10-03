import { FastifyRequest } from 'fastify';
import { GetRestaurantUseCase } from '../../application/use-cases/GetRestaurantUseCase.js';

export interface ForbiddenProblem {
  type: string;
  title: string;
  status: 403;
  detail: string;
}

/**
 * Answers "is this admin allowed to touch restaurant X" — the sibling
 * question to TenantResolver.ts's "which tenant does this request target".
 * Previously copy-pasted across RestaurantController.update() and
 * updateCategories() with slightly different wording (review finding); now
 * one place both methods (and list()) share. Returns the 403 problem-detail
 * body to send, or null when the actor may proceed.
 */
export async function assertOwnsRestaurant(
  req: FastifyRequest,
  targetIdentifier: string | undefined,
  getRestaurantUseCase: GetRestaurantUseCase,
  actionLabel: string
): Promise<ForbiddenProblem | null> {
  const auth = req.authContext;
  if (auth?.role === 'super_admin') return null;

  if (!auth?.restaurantId) {
    return {
      type: 'https://example.com/probs/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Restaurant administrator has no assigned restaurant.',
    };
  }

  if (targetIdentifier && targetIdentifier !== auth.restaurantId) {
    const assigned = await getRestaurantUseCase.execute(auth.restaurantId);
    if (!assigned || (assigned.id !== targetIdentifier && assigned.slug !== targetIdentifier)) {
      return {
        type: 'https://example.com/probs/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: `You are only authorized to ${actionLabel}.`,
      };
    }
  }

  return null;
}
