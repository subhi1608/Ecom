import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

function fakeRequest(correlationId = 'corr-1') {
  return { correlationId, headers: {} } as any;
}

describe('AppController.createOrder', () => {
  function setup() {
    const http: any = { post: jest.fn(), get: jest.fn() };
    const controller = new AppController(http);
    return { controller, http };
  }

  it('forwards the Idempotency-Key header to order-service when the client sends one', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(of({ data: { id: 'order-1' } }));

    await controller.createOrder(
      { productId: 'p1', quantity: 1, customerEmail: 'a@b.com' } as any,
      fakeRequest(),
      'idem-key-1',
    );

    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/orders'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-correlation-id': 'corr-1',
          'idempotency-key': 'idem-key-1',
        }),
      }),
    );
  });

  it('omits the Idempotency-Key header entirely when the client sends none', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(of({ data: { id: 'order-1' } }));

    await controller.createOrder(
      { productId: 'p1', quantity: 1, customerEmail: 'a@b.com' } as any,
      fakeRequest(),
    );

    const callArgs = http.post.mock.calls[0];
    expect(callArgs[2].headers).not.toHaveProperty('idempotency-key');
  });

  it('opens the circuit after repeated order-service failures and short-circuits without calling http', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(throwError(() => new Error('order-service down')));

    const dto = { productId: 'p1', quantity: 1, customerEmail: 'a@b.com' } as any;

    for (let i = 0; i < 5; i++) {
      await expect(controller.createOrder(dto, fakeRequest())).rejects.toThrow();
    }

    http.post.mockClear();
    await expect(controller.createOrder(dto, fakeRequest())).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(http.post).not.toHaveBeenCalled();
  });
});
