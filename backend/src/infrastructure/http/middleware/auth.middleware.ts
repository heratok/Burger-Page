import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService } from '../../security/JwtService.js';
import { UserRole } from '../../../domain/models/User.js';

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

export interface AuthMiddlewares {
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireSuperAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireAnyAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  tryAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireStreamToken: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function createAuthMiddlewares(jwt: JwtService = new JwtService()): AuthMiddlewares {
  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
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
      req.authContext = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
        restaurantId: payload.restaurantId,
      };
    } catch (err: any) {
      return reply.status(401).send({
        type: 'https://example.com/probs/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: err.message || 'Invalid or expired token.',
      });
    }
  }

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
        req.authContext = {
          userId: payload.sub,
          username: payload.username,
          role: payload.role,
          restaurantId: payload.restaurantId,
        };
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
        req.authContext = {
          userId: payload.sub,
          username: payload.username,
          role: payload.role,
          restaurantId: payload.restaurantId,
        };
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

  return { requireAuth, requireSuperAdmin, requireAnyAdmin, tryAuth, requireStreamToken };
}

const defaultMiddlewares = createAuthMiddlewares();
export const requireAuth = defaultMiddlewares.requireAuth;
export const requireSuperAdmin = defaultMiddlewares.requireSuperAdmin;
export const requireAnyAdmin = defaultMiddlewares.requireAnyAdmin;
export const tryAuth = defaultMiddlewares.tryAuth;
export const requireStreamToken = defaultMiddlewares.requireStreamToken;
