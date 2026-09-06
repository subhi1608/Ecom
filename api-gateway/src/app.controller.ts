import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto';
import { CircuitBreaker } from './common/circuit-breaker';
import { buildForwardedHeaders } from './common/request-headers';
import { isDownstreamClientError, translateProxyError } from './common/proxy-error';
import { JwtAuthGuard } from './common/jwt-auth.guard';

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

// Every inter-service call from the gateway gets a hard timeout so a stuck
// downstream never hangs a client request indefinitely.
const REQUEST_TIMEOUT_MS = 5000;

// This is a thin proxy for the starter. As services grow, this is where
// you'd add auth checks, request validation, and a circuit breaker around
// each downstream call (see the execution plan, Phase 4).
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class AppController {
  // One breaker per downstream dependency (order-service here) — 5
  // consecutive failures trips it, 30s later a single probe call is let
  // through to test recovery.
  private readonly orderServiceBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    // A 4xx means order-service answered — it is healthy and simply rejected
    // this request. Counting those would let five lookups of a missing order
    // (or five ownership rejections) open the circuit and take the endpoint
    // down for every user.
    isFailure: (err) => !isDownstreamClientError(err),
  });

  constructor(private readonly http: HttpService) {}

  @Post()
  async createOrder(
    @Body() body: CreateOrderDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orderServiceBreaker.execute(async () => {
      try {
        const res = await firstValueFrom(
        this.http
          .post(`${ORDER_SERVICE_URL}/orders`, body, {
            headers: buildForwardedHeaders(req.correlationId, idempotencyKey, req.authToken),
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
        return res.data;
      } catch (err) {
        throw translateProxyError(err);
      }
    });
  }

  @Get()
  async listOrders(
    @Query() query: Record<string, string>,
    @Req() req: Request,
  ) {
    return this.orderServiceBreaker.execute(async () => {
      try {
        const res = await firstValueFrom(
        this.http
          .get(`${ORDER_SERVICE_URL}/orders`, {
            params: query,
            headers: buildForwardedHeaders(req.correlationId, undefined, req.authToken),
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
        return res.data;
      } catch (err) {
        throw translateProxyError(err);
      }
    });
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Req() req: Request) {
    return this.orderServiceBreaker.execute(async () => {
      try {
        const res = await firstValueFrom(
        this.http
          .get(`${ORDER_SERVICE_URL}/orders/${id}`, {
            headers: buildForwardedHeaders(req.correlationId, undefined, req.authToken),
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
        return res.data;
      } catch (err) {
        throw translateProxyError(err);
      }
    });
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Req() req: Request) {
    return this.orderServiceBreaker.execute(async () => {
      try {
        const res = await firstValueFrom(
        this.http
          .post(
            `${ORDER_SERVICE_URL}/orders/${id}/cancel`,
            {},
            { headers: buildForwardedHeaders(req.correlationId, undefined, req.authToken) },
          )
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
        return res.data;
      } catch (err) {
        throw translateProxyError(err);
      }
    });
  }
}
