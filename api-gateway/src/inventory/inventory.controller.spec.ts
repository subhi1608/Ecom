import { NEVER, of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';

describe('InventoryController.getStock', () => {
  function setup() {
    const http: any = { get: jest.fn() };
    const controller = new InventoryController(http);
    return { controller, http };
  }

  it('returns the downstream response data', async () => {
    const { controller, http } = setup();
    http.get.mockReturnValue(of({ data: { productId: 'p1', available: 10 } }));

    const result = await controller.getStock('p1', { correlationId: 'corr-1' } as any);

    expect(result).toEqual({ productId: 'p1', available: 10 });
  });

  it('surfaces a downstream connection failure as 503 without leaking internals', async () => {
    const { controller, http } = setup();
    http.get.mockReturnValue(throwError(() => new Error('inventory-service down')));

    const err = await controller
      .getStock('p1', { correlationId: 'corr-1' } as any)
      .catch((e) => e);

    // Translated to a clean 503. The raw internal message must NOT reach the
    // client — previously it propagated verbatim, leaking internal detail.
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(err.getResponse())).not.toContain('inventory-service down');
  });

  it('times out instead of hanging forever when inventory-service never responds', async () => {
    jest.useFakeTimers();
    const { controller, http } = setup();
    http.get.mockReturnValue(NEVER);

    const promise = expect(
      controller.getStock('p1', { correlationId: 'corr-1' } as any),
    ).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(6000);
    await promise;
    jest.useRealTimers();
  });
});
