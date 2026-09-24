import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, EntityNotFoundError, ValidationError, InvalidOrderStateError, UnauthorizedError } from '../../../domain/errors/DomainErrors.js';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  // M5: internal messages are only exposed on an explicit opt-in
  // (API_EXPOSE_ERRORS=true) or outside production. Production always hides
  // the error.message even when NODE_ENV is unset, and tests can force
  // exposure/inspection regardless of the environment.
  const exposeErrorDetails = process.env.API_EXPOSE_ERRORS === 'true' || process.env.NODE_ENV !== 'production';

  // Domain errors
  if (error instanceof DomainError) {
    if (error instanceof EntityNotFoundError) {
      return reply.status(404).send({
        type: 'https://example.com/probs/not-found',
        title: 'Entity Not Found',
        status: 404,
        detail: error.message
      });
    }
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        type: 'https://example.com/probs/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: error.message
      });
    }
    if (error instanceof InvalidOrderStateError) {
      return reply.status(400).send({
        type: 'https://example.com/probs/invalid-state',
        title: 'Invalid State',
        status: 400,
        detail: error.message
      });
    }
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        type: 'https://example.com/probs/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: error.message
      });
    }

    return reply.status(400).send({
      type: 'https://example.com/probs/domain-error',
      title: 'Domain Error',
      status: 400,
      detail: error.message
    });
  }

  // Zod schema errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      type: 'https://example.com/probs/validation-error',
      title: 'Validation Error',
      status: 400,
      detail: 'Invalid request payload',
      errors: error.flatten().fieldErrors
    });
  }

  // Fastify internal validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      type: 'https://example.com/probs/validation-error',
      title: 'Validation Error',
      status: 400,
      detail: error.message
    });
  }

  // Framework-produced client errors (e.g. rate limit 429, banned 403, 404 route)
  const statusCode = (error as FastifyError).statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    const isRateLimit = statusCode === 429;
    return reply.status(statusCode).send({
      type: isRateLimit ? 'https://example.com/probs/rate-limited' : 'https://example.com/probs/request-error',
      title: isRateLimit ? 'Too Many Requests' : 'Request Error',
      status: statusCode,
      detail: error.message || 'Request could not be processed.'
    });
  }

  // Fallback generic 500 error - log full context and never let process crash.
  // The internal message stays server-side only unless explicitly exposed.
  request.log.error({ err: error, url: request.url, method: request.method }, 'Unhandled Exception');
  return reply.status(500).send({
    type: 'https://example.com/probs/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: exposeErrorDetails ? (error.message || 'An unexpected error occurred.') : 'An unexpected error occurred.'
  });
}