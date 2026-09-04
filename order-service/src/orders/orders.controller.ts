import { Body, Controller, Post, Get, Param, Req } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Called by the API gateway
  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.createOrder(dto, req.correlationId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  // --- Event consumers: downstream services report back here ---
  // Every event on the bus now arrives wrapped as { correlationId, data }.

  @EventPattern('payment_completed')
  async handlePaymentCompleted(
    @Payload() message: { correlationId: string; data: { orderId: string } },
  ) {
    await this.ordersService.markFulfilled(message.data.orderId, message.correlationId);
  }

  @EventPattern('payment_failed')
  async handlePaymentFailed(
    @Payload() message: { correlationId: string; data: { orderId: string; reason: string } },
  ) {
    await this.ordersService.markFailed(
      message.data.orderId,
      message.data.reason,
      message.correlationId,
    );
  }

  @EventPattern('stock_failed')
  async handleStockFailed(
    @Payload() message: { correlationId: string; data: { orderId: string; reason: string } },
  ) {
    await this.ordersService.markFailed(
      message.data.orderId,
      message.data.reason,
      message.correlationId,
    );
  }
}
