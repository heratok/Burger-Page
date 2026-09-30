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
