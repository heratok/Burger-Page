import crypto from 'node:crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getSupabaseClient } from '../../persistence/supabase/SupabaseClient.js';
import { defaultStorageUrlResolver } from '../../storage/StorageUrlResolver.js';

/**
 * Builds a server-owned, safe object key stem from a client-supplied filename.
 * Every character outside [a-zA-Z0-9._-] is replaced with '-', leading dots and
 * dashes are stripped (blocks ".." traversal segments and dotfile keys), and
 * the result is capped at 80 chars. A client filename can therefore never
 * introduce path separators, traversal segments, or cross-tenant keys into the
 * storage object path. Falls back to a random UUID when nothing survives.
 */
export function sanitizeStorageObjectName(filename: string): string {
  const cleaned = filename.replace(/[^a-z0-9._-]/gi, '-').replace(/^[.\-]+/, '').slice(0, 80);
  return cleaned || crypto.randomUUID();
}

export async function storageRoutes(fastify: FastifyInstance) {
  fastify.post('/upload-url', {
    preHandler: [requireAuth],
    schema: {
      tags: ['Storage'],
      summary: 'Generate a presigned upload URL for Direct-to-Storage upload',
      description: 'Allows authenticated users to request a short-lived signed upload URL for Supabase Storage without exposing keys to the client.',
      body: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string' },
          folder: { type: 'string', enum: ['products', 'branding', 'general'], default: 'products' },
          filename: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['signed_url', 'local_fallback'] },
            uploadUrl: { type: 'string' },
            token: { type: 'string' },
            path: { type: 'string' },
            publicUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body || {}) as { restaurantId?: string; folder?: string; filename?: string };
    const authRestId = req.authContext?.restaurantId;
    const isSuper = req.authContext?.role === 'super_admin';

    const targetRestaurantId = isSuper
      ? (body.restaurantId || authRestId || 'global')
      : (authRestId || body.restaurantId || 'default');
    const folder = body.folder || 'products';
    const cleanRestId = targetRestaurantId.replace(/[^a-z0-9-_]/gi, '-');
    // Never splice the raw client filename into the object key: sanitize it
    // (or fall back to a random UUID) so the key stays a single, tenant-
    // scoped segment even with upsert:true.
    const uniqueId = body.filename ? sanitizeStorageObjectName(body.filename) : crypto.randomUUID();
    const objectPath = `${cleanRestId}/${folder}/${uniqueId}.webp`;

    const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY;
    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.STORAGE_BUCKET ||
      'image';

    if (!supabaseUrl || !supabaseKey) {
      return reply.status(200).send({
        mode: 'local_fallback',
        path: objectPath,
      });
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath, { upsert: true });

      if (error || !data) {
        req.log.warn({ err: error }, 'Could not create signed upload URL from Supabase, falling back');
        return reply.status(200).send({
          mode: 'local_fallback',
          path: objectPath,
        });
      }

      const publicUrl = defaultStorageUrlResolver.resolveImageUrl(objectPath, bucket);

      return reply.status(200).send({
        mode: 'signed_url',
        uploadUrl: data.signedUrl,
        token: data.token,
        path: objectPath,
        publicUrl,
      });
    } catch (err: any) {
      req.log.warn({ err: err?.message }, 'Supabase client error generating signed URL, falling back');
      return reply.status(200).send({
        mode: 'local_fallback',
        path: objectPath,
      });
    }
  });
}
