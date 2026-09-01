import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('payment_completed')
  async handlePaymentCompleted(@Payload() data: any) {
    await this.notificationService.sendOrderConfirmation(data);
  }
}
