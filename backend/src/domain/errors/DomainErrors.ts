export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {}
export class ValidationError extends DomainError {}
export class InvalidOrderStateError extends DomainError {}
export class UnauthorizedError extends DomainError {}
