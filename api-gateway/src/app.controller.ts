import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto';

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

// This is a thin proxy for the starter. As services grow, this is where
// you'd add auth checks, request validation, and a circuit breaker around
// each downstream call (see the execution plan, Phase 4).
@Controller('orders')
export class AppController {
  constructor(private readonly http: HttpService) {}

  @Post()
  async createOrder(@Body() body: CreateOrderDto, @Req() req: Request) {
    const res = await firstValueFrom(
      this.http.post(`${ORDER_SERVICE_URL}/orders`, body, {
        headers: { 'x-correlation-id': req.correlationId },
      }),
    );
    return res.data;
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Req() req: Request) {
    const res = await firstValueFrom(
      this.http.get(`${ORDER_SERVICE_URL}/orders/${id}`, {
        headers: { 'x-correlation-id': req.correlationId },
      }),
    );
    return res.data;
  }
}
