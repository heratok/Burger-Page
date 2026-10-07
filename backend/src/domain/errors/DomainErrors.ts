export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {}
export class ValidationError extends DomainError {}
export class ConflictError extends DomainError {}
export class InvalidOrderStateError extends DomainError {}
export class UnauthorizedError extends DomainError {}
/** The caller is authenticated but not allowed to perform this action (HTTP 403). */
export class ForbiddenError extends DomainError {}
