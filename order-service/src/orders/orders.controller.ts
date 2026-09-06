import {
  Body,
  Controller,
  Post,
  Get,
  Headers,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Called by the API gateway. The guard applies only to these HTTP routes —
  // the @EventPattern consumers below arrive over RMQ and carry no JWT.
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createOrder(
      dto,
      req.correlationId,
      req.user.email,
      idempotencyKey,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Req() req: Request,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listOrders(
      {
        status,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      req.user.email,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getOrder(id, req.user.email);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.cancelOrder(id, req.correlationId, req.user.email);
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
