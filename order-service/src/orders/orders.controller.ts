import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Called by the API gateway
  @Post()
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  // --- Event consumers: downstream services report back here ---

  @EventPattern('payment_completed')
  async handlePaymentCompleted(@Payload() data: any) {
    await this.ordersService.markFulfilled(data.orderId);
  }

  @EventPattern('payment_failed')
  async handlePaymentFailed(@Payload() data: any) {
    await this.ordersService.markFailed(data.orderId, data.reason);
  }

  @EventPattern('stock_failed')
  async handleStockFailed(@Payload() data: any) {
    await this.ordersService.markFailed(data.orderId, data.reason);
  }
}
