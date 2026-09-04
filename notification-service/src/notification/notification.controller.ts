import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('payment_completed')
  async handlePaymentCompleted(
    @Payload() message: { correlationId: string; data: { orderId: string; customerEmail: string } },
  ) {
    await this.notificationService.sendOrderConfirmation(message.data, message.correlationId);
  }
}
