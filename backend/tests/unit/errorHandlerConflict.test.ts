import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/infrastructure/http/middlewares/errorHandler.js';
import { ConflictError } from '../../src/domain/errors/DomainErrors.js';

describe('errorHandler ConflictError (5.2)', () => {
  it('maps ConflictError to 409 with the message as detail', () => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    errorHandler(new ConflictError("An inventory item named 'Pan' already exists."), {} as any, { status } as any);
    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, detail: "An inventory item named 'Pan' already exists." })
    );
  });
});

describe('errorHandler Postgres unique violations (review B4 safety net)', () => {
  const run = (err: Error) => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    errorHandler(err, { log: { error: vi.fn() } } as any, { status } as any);
    return { status, send };
  };
  const pgError = (constraint: string) => Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint });

  it('maps a restaurants.slug unique violation to 409 naming the slug', () => {
    const { status, send } = run(pgError('restaurants_slug_key'));
    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ status: 409, detail: expect.stringMatching(/slug/i) }));
  });

  it('maps a users.username unique violation to 409 naming the username', () => {
    const { status, send } = run(pgError('users_username_key'));
    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/username/i) }));
  });

  it('does not leak the SQL message and leaves other unique violations as a generic 409', () => {
    const { status, send } = run(pgError('something_else_key'));
    expect(status).toHaveBeenCalledWith(409);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/duplicate key/);
  });
});
