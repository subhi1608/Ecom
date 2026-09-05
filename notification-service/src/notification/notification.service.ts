import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async sendOrderConfirmation(
    data: { orderId: string; customerEmail: string },
    correlationId: string,
  ): Promise<boolean> {
    // Mocked — swap for a real email/SMS provider later. The ~10% failure
    // rate (mirroring payment-service's mock gateway) exists so the
    // retry/DLQ path in NotificationController is actually exercised.
    const success = Math.random() > 0.1;

    if (!success) {
      console.log(
        `[notification-service] [${correlationId}] (mock) send FAILED for order ${data.orderId}`,
      );
      return false;
    }

    console.log(
      `[notification-service] [${correlationId}] (mock) email sent to ${data.customerEmail} for order ${data.orderId}`,
    );
    return true;
  }
}
