import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { RmqPublisherService } from './rmq-publisher.service';

const MAX_RETRIES = 3;

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly publisher: RmqPublisherService,
  ) {}

  @EventPattern('payment_completed')
  async handlePaymentCompleted(
    @Payload()
    message: {
      correlationId: string;
      data: { orderId: string; customerEmail: string };
      retryCount?: number;
    },
  ) {
    const succeeded = await this.notificationService.sendOrderConfirmation(
      message.data,
      message.correlationId,
    );
    if (succeeded) return;

    const nextRetryCount = (message.retryCount ?? 0) + 1;
    const envelope = {
      correlationId: message.correlationId,
      data: message.data,
      retryCount: nextRetryCount,
    };

    if (nextRetryCount <= MAX_RETRIES) {
      this.publisher.publishToQueue('events_queue.retry', 'payment_completed', envelope);
    } else {
      this.publisher.publishToQueue('events_queue.dlq', 'payment_completed', envelope);
    }
  }
}
