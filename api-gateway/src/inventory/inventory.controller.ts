import { Controller, Get, Param, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Request } from 'express';
import { buildForwardedHeaders } from '../common/request-headers';

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

const REQUEST_TIMEOUT_MS = 5000;

@Controller('inventory')
export class InventoryController {
  constructor(private readonly http: HttpService) {}

  @Get(':productId')
  async getStock(@Param('productId') productId: string, @Req() req: Request) {
    const res = await firstValueFrom(
      this.http
        .get(`${INVENTORY_SERVICE_URL}/${productId}`, {
          headers: buildForwardedHeaders(req.correlationId),
        })
        .pipe(timeout(REQUEST_TIMEOUT_MS)),
    );
    return res.data;
  }
}
