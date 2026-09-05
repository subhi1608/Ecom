import { NEVER, of, throwError } from 'rxjs';
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

  it('propagates a downstream failure instead of hanging', async () => {
    const { controller, http } = setup();
    http.get.mockReturnValue(throwError(() => new Error('inventory-service down')));

    await expect(
      controller.getStock('p1', { correlationId: 'corr-1' } as any),
    ).rejects.toThrow('inventory-service down');
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
