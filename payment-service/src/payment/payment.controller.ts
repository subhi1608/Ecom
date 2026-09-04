import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern('stock_reserved')
  async handleStockReserved(
    @Payload()
    message: {
      correlationId: string;
      data: { orderId: string; productId: string; quantity: number; customerEmail: string };
    },
  ) {
    await this.paymentService.processPayment(message.data, message.correlationId);
  }
}
