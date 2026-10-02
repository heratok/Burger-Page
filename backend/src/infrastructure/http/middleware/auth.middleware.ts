import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService } from '../../security/JwtService.js';
import { UserRole } from '../../../domain/models/User.js';
import { UserRepository } from '../../../domain/ports/out/UserRepository.js';
import { RestaurantRepository } from '../../../domain/ports/out/RestaurantRepository.js';

export interface AuthContext {
  userId: string;
  username: string;
  role: UserRole;
  restaurantId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

/**
 * Optional repository hooks for JWT revalidation (SUS-14). When userRepo is
 * supplied, requireAuth re-reads the token subject from storage on every
 * request instead of trusting the signed claims: missing, deactivated, or
 * demoted accounts are rejected/overridden immediately rather than waiting
 * for token expiry. When restaurantRepo is supplied, a user bound to a
 * restaurantId also has their tenant's is_active re-checked.
 */
export interface AuthMiddlewareDeps {
  userRepo?: UserRepository;
  restaurantRepo?: RestaurantRepository;
}

export interface AuthMiddlewares {
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** Like requireAuth, but also admits accounts that must change their temporary password. Only for the change-password route. */
  requireAuthAllowingPasswordChange: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireSuperAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAnyAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  tryAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireStreamToken: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function createAuthMiddlewares(
  jwt: JwtService = new JwtService(),
  deps?: AuthMiddlewareDeps
): AuthMiddlewares {
  type ResolvedSession =
    | { ok: true; authContext: AuthContext; mustChangePassword: boolean }
    | { ok: false; detail: string };

  /**
   * Single source of truth for turning verified token claims into a session
   * (SUS-14): the stored account and tenant, not the signed claims, decide
   * whether the session is valid and what it may do. Shared by requireAuth and
   * tryAuth so optional auth can never grant more than mandatory auth.
   */
  async function resolveSession(payload: ReturnType<JwtService['verifyToken']>): Promise<ResolvedSession> {
    const authContext: AuthContext = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      restaurantId: payload.restaurantId,
    };
    // Test runs skip revalidation, so the signed claim is the fallback; when
    // the stored row is available it overrides the claim (below).
    let mustChangePassword = payload.mustChangePassword === true;

    // SUS-14: signed claims age up to 7 days, so a deactivated or demoted
    // account must be re-validated against storage on every authenticated
    // request. The stored row wins over the stale claims: the current role,
    // username, and restaurantId actually governing the session come from
    // the repository, never from the token.
    if (deps?.userRepo) {
      const user = await deps.userRepo.findById(payload.sub);
      if (!user) {
        // Fail closed: the token references an account that no longer
        // exists, so whatever the signed claims say, it is unauthorized.
        return { ok: false, detail: 'Account no longer exists.' };
      }
      if (user.isActive === false) {
        // Licensed accounts keep their 7-day token but lose access the
        // moment is_active flips; the stored flag is the source of truth.
        return { ok: false, detail: 'Account is deactivated.' };
      }
      authContext.userId = user.id;
      authContext.username = user.username;
      authContext.role = user.role;
      authContext.restaurantId = user.restaurantId;
      mustChangePassword = user.mustChangePassword === true;
    }

    // SUS-14: a tenant deactivated server-side must stop accepting its
    // admins' mutations immediately, not after their token expires.
    if (deps?.restaurantRepo && authContext.restaurantId) {
      const restaurant = await deps.restaurantRepo.findById(authContext.restaurantId);
      if (!restaurant || !restaurant.isActive) {
        return { ok: false, detail: 'Restaurant is deactivated.' };
      }
    }

    return { ok: true, authContext, mustChangePassword };
  }

  async function authenticate(req: FastifyRequest, reply: FastifyReply, allowPendingPasswordChange: boolean) {
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
    if (!token) {
      return reply.status(401).send({
        type: 'https://example.com/probs/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing or invalid Authorization header. Expected Bearer token.',
      });
    }
    try {
      const payload = jwt.verifyToken(token);
      if (payload.scope && payload.scope !== 'session') {
        return reply.status(401).send({
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Token has restricted scope and cannot be used for general API access.',
        });
      }
      const resolved = await resolveSession(payload);
      if (!resolved.ok) {
        return reply.status(401).send({
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: resolved.detail,
        });
      }
      const { authContext, mustChangePassword } = resolved;

      if (mustChangePassword && !allowPendingPasswordChange) {
        return reply.status(403).send({
          type: 'https://example.com/probs/password-change-required',
          title: 'Password Change Required',
          status: 403,
          code: 'PASSWORD_CHANGE_REQUIRED',
          detail: 'You must change your temporary password before using the API.',
        });
      }

      req.authContext = authContext;
    } catch (err: any) {
      return reply.status(401).send({
        type: 'https://example.com/probs/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: err.message || 'Invalid or expired token.',
      });
    }
  }

  const requireAuth = (req: FastifyRequest, reply: FastifyReply) => authenticate(req, reply, false);
  const requireAuthAllowingPasswordChange = (req: FastifyRequest, reply: FastifyReply) =>
    authenticate(req, reply, true);

  async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
    await requireAuth(req, reply);
    if (reply.sent) return;

    if (req.authContext?.role !== 'super_admin') {
      return reply.status(403).send({
        type: 'https://example.com/probs/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Super Administrator privileges required to access this resource.',
      });
    }
  }

  async function requireAnyAdmin(req: FastifyRequest, reply: FastifyReply) {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const role = req.authContext?.role;
    if (role !== 'super_admin' && role !== 'restaurant_admin') {
      return reply.status(403).send({
        type: 'https://example.com/probs/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Administrator privileges required to access this resource.',
      });
    }
  }

  async function tryAuth(req: FastifyRequest, _reply: FastifyReply) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = jwt.verifyToken(token);
        if (payload.scope && payload.scope !== 'session') return; // restricted token never authenticates storefront calls
        const resolved = await resolveSession(payload);
        // Optional auth degrades to anonymous: an invalid account, a deactivated
        // tenant or a pending forced password change never grants staff context.
        if (!resolved.ok || resolved.mustChangePassword) return;
        req.authContext = resolved.authContext;
      } catch {
        // Token inválido o expirado en endpoint público: ignorar para permitir acceso público como guest
      }
    }
  }

  /**
   * Middleware for the EventSource stream: accepts either a regular Bearer
   * token (fetch-based clients) or a short-lived 'sse'-scoped token in the
   * query string (browser EventSource cannot send headers). Full-session
   * JWTs in URLs are rejected on every other endpoint.
   */
  async function requireStreamToken(req: FastifyRequest, reply: FastifyReply) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await requireAuth(req, reply);
      if (reply.sent) return;
    } else {
      const queryToken = (req.query as any)?.token;
      if (!queryToken) {
        return reply.status(401).send({
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid Authorization header. Expected Bearer token or SSE stream token.',
        });
      }
      try {
        const payload = jwt.verifyToken(queryToken);
        if (payload.scope !== 'sse') {
          return reply.status(401).send({
            type: 'https://example.com/probs/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Stream token is invalid for this purpose.',
          });
        }
        const resolved = await resolveSession(payload);
        if (!resolved.ok) {
          return reply.status(401).send({
            type: 'https://example.com/probs/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: resolved.detail,
          });
        }
        if (resolved.mustChangePassword) {
          return reply.status(403).send({
            type: 'https://example.com/probs/password-change-required',
            title: 'Password Change Required',
            status: 403,
            code: 'PASSWORD_CHANGE_REQUIRED',
            detail: 'You must change your temporary password before using the API.',
          });
        }
        const authContext = resolved.authContext;

        req.authContext = authContext;
      } catch (err: any) {
        return reply.status(401).send({
          type: 'https://example.com/probs/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: err.message || 'Invalid or expired stream token.',
        });
      }
    }
  }

  return { requireAuth, requireAuthAllowingPasswordChange, requireSuperAdmin, requireAnyAdmin, tryAuth, requireStreamToken };
}

let defaultMiddlewares = createAuthMiddlewares();
// ESM live bindings: re-assigning these (configureAuthMiddlewares) upgrades
// every route file that imports { requireAuth, … } without touching it.
export let requireAuth = defaultMiddlewares.requireAuth;
export let requireAuthAllowingPasswordChange = defaultMiddlewares.requireAuthAllowingPasswordChange;
export let requireSuperAdmin = defaultMiddlewares.requireSuperAdmin;
export let requireAnyAdmin = defaultMiddlewares.requireAnyAdmin;
export let tryAuth = defaultMiddlewares.tryAuth;
export let requireStreamToken = defaultMiddlewares.requireStreamToken;

/**
 * Re-creates the process-wide auth middlewares with repository-backed JWT
 * revalidation (SUS-14) and rebinds the exported singletons. Wiring belongs
 * to the app bootstrap (buildApp) so the hardened rule set applies to every
 * route that imports the defaults. When no repos are supplied (or this is
 * never called), the exports keep the legacy JWT-claims-only behavior.
 */
export function configureAuthMiddlewares(deps: AuthMiddlewareDeps): void {
  defaultMiddlewares = createAuthMiddlewares(new JwtService(), deps);
  requireAuth = defaultMiddlewares.requireAuth;
  requireAuthAllowingPasswordChange = defaultMiddlewares.requireAuthAllowingPasswordChange;
  requireSuperAdmin = defaultMiddlewares.requireSuperAdmin;
  requireAnyAdmin = defaultMiddlewares.requireAnyAdmin;
  tryAuth = defaultMiddlewares.tryAuth;
  requireStreamToken = defaultMiddlewares.requireStreamToken;
}
