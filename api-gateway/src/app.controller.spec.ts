import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

function fakeRequest(correlationId = 'corr-1') {
  return { correlationId, authToken: 'jwt-token', headers: {} } as any;
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
      { productId: 'p1', quantity: 1 } as any,
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
      { productId: 'p1', quantity: 1 } as any,
      fakeRequest(),
    );

    const callArgs = http.post.mock.calls[0];
    expect(callArgs[2].headers).not.toHaveProperty('idempotency-key');
  });

  it('opens the circuit after repeated order-service failures and short-circuits without calling http', async () => {
    const { controller, http } = setup();
    http.post.mockReturnValue(throwError(() => new Error('order-service down')));

    const dto = { productId: 'p1', quantity: 1 } as any;

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

describe('AppController downstream error translation', () => {
  function setup() {
    const http: any = { post: jest.fn(), get: jest.fn() };
    return { controller: new AppController(http), http };
  }

  function axiosFailure(status: number) {
    return {
      isAxiosError: true,
      message: `Request failed with status code ${status}`,
      response: { status, data: { statusCode: status, message: 'Order abc not found' } },
    };
  }

  it('preserves a downstream 404 instead of collapsing it to 500', async () => {
    const { controller, http } = setup();
    http.get.mockReturnValue(throwError(() => axiosFailure(404)));

    await expect(controller.getOrder('abc', fakeRequest())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('does not trip the circuit breaker on 4xx responses', async () => {
    // order-service answering 404 proves it is HEALTHY. If these counted as
    // failures, five users looking up a missing order would open the circuit
    // and take the whole orders endpoint down for everyone for 30 seconds.
    const { controller, http } = setup();
    http.get.mockReturnValue(throwError(() => axiosFailure(404)));

    for (let i = 0; i < 6; i++) {
      await expect(controller.getOrder('abc', fakeRequest())).rejects.toMatchObject({
        status: 404,
      });
    }

    // Circuit must still be closed — a good request gets through.
    http.get.mockReturnValue(of({ data: { id: 'order-1' } }));
    await expect(controller.getOrder('order-1', fakeRequest())).resolves.toEqual({
      id: 'order-1',
    });
  });

  it('still trips the circuit breaker on real downstream outages', async () => {
    const { controller, http } = setup();
    http.get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    for (let i = 0; i < 5; i++) {
      await expect(controller.getOrder('abc', fakeRequest())).rejects.toThrow();
    }

    http.get.mockClear();
    await expect(controller.getOrder('abc', fakeRequest())).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('AppController auth forwarding', () => {
  it('forwards the verified token downstream as a Bearer header', async () => {
    const http: any = { post: jest.fn(), get: jest.fn() };
    const controller = new AppController(http);
    http.post.mockReturnValue(of({ data: { id: 'order-1' } }));

    await controller.createOrder(
      { productId: 'p1', quantity: 1 } as any,
      { correlationId: 'corr-1', authToken: 'jwt-token', headers: {} } as any,
    );

    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/orders'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer jwt-token' }),
      }),
    );
  });
});
