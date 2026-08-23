import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, EntityNotFoundError, ValidationError, InvalidOrderStateError, UnauthorizedError } from '../../../domain/errors/DomainErrors.js';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
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

  // Fallback generic 500 error - log full context and never let process crash
  request.log.error({ err: error, url: request.url, method: request.method }, 'Unhandled Exception');
  return reply.status(500).send({
    type: 'https://example.com/probs/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: error.message || 'An unexpected error occurred.'
  });
}
