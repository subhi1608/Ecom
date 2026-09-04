import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async sendOrderConfirmation(
    data: { orderId: string; customerEmail: string },
    correlationId: string,
  ) {
    // Mocked — swap for a real email/SMS provider later.
    // This is also where you'd add retry-with-backoff (see README
    // "Next steps") if the provider call fails.
    console.log(
      `[notification-service] [${correlationId}] (mock) email sent to ${data.customerEmail} for order ${data.orderId}`,
    );
  }
}
