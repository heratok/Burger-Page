import { FastifyRequest } from 'fastify';

/**
 * Client address used to key the rate limiter.
 *
 * - `trustProxy` false: the socket peer (X-Forwarded-For is ignored, so a
 *   client cannot spoof a fresh bucket).
 * - `trustProxy` true: Fastify's req.ip, i.e. the left-most forwarded entry.
 *   Only safe behind a proxy that REPLACES X-Forwarded-For (Caddy does).
 * - `trustProxy` = N hops: read the forwarded chain from the RIGHT, skipping
 *   the N trusted proxies, so entries a client prepends itself are never used.
 *   Needed behind proxies that APPEND to a client-supplied header (e.g. a CDN).
 *   Fastify's own hop-count handling fails closed in this build, hence this
 *   explicit implementation.
 */
export function rateLimitClientKey(req: FastifyRequest, trustProxy: boolean | number): string {
  const socketAddress = req.socket?.remoteAddress || req.ip;
  if (trustProxy === true) return req.ip;
  if (typeof trustProxy !== 'number' || trustProxy <= 0) return socketAddress;

  const header = req.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header.join(',') : header || '';
  const forwarded = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  // Chain as seen from this process: client, ...proxies, direct peer.
  const chain = [...forwarded, socketAddress];
  const index = Math.max(0, chain.length - 1 - trustProxy);
  return chain[index] || socketAddress;
}
