import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { orderStatusEnum } from '@burger-page/contracts';

// Single source of truth for HTTP request-body JSON schemas: derived from the
// @burger-page/contracts zod contracts instead of hand-maintained inline
// duplicates. Controllers still re-validate every body with zod .safeParse();
// these derived schemas feed AJV pre-validation and the OpenAPI docs.

const jsonSchemaCache = new Map<string, Record<string, unknown>>();

/**
 * Derive a self-contained JSON schema (no $refs — Fastify needs none) from a
 * zod contract, memoized by name: the same name always returns the same
 * object reference.
 *
 * Configuration notes (behavior pinned by tests/unit/zodSchemas.test.ts):
 * - `$refStrategy: 'none'` inlines every sub-schema. Passing the `name` to
 *   the converter instead wraps the output in a root `$ref` + `definitions`
 *   bag, which is not self-contained, so `name` is used only as the cache key.
 * - `target: 'openApi3'` drives the Swagger/OpenAPI docs. Caveat: openApi3
 *   renders `z.number().int().positive()` as `{ minimum: 0, exclusiveMinimum:
 *   true }` (draft-04/openapi3 dialect) which AJV (draft-07) refuses to
 *   compile. Contracts containing that (createOrderSchema/updateOrderSchema
 *   via orderItemInputSchema.quantity) are NOT AJV-safe and their routes keep
 *   inline bodies — see order.routes.ts.
 * - `removeAdditionalStrategy: 'strict'` maps zod's default `strip` object
 *   behavior to `additionalProperties: true` (accept + ignore), matching both
 *   zod and Fastify's `removeAdditional` runtime.
 */
export function jsonSchemaFromZod<T>(schema: z.ZodType<T>, name: string): Record<string, unknown> {
  const cached = jsonSchemaCache.get(name);
  if (cached) return cached;
  // z2js v3.25 types resolve ZodSchema from its own zod copy (the root
  // "zod/v3" compat of zod 4), which is not structurally identical to the
  // app's zod 3 ZodType — bridge through unknown instead of forcing a
  // cross-copy assignability check.
  const json = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0], {
    $refStrategy: 'none',
    target: 'openApi3',
    removeAdditionalStrategy: 'strict',
  }) as unknown as Record<string, unknown>;
  jsonSchemaCache.set(name, json);
  return json;
}

/** Inline enum values for request-body schemas that must remain inline. */
export const ORDER_STATUS_JSON: string[] = [...orderStatusEnum.options];