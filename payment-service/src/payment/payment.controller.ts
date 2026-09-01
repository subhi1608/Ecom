import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern('stock_reserved')
  async handleStockReserved(@Payload() data: any) {
    await this.paymentService.processPayment(data);
  }
}
