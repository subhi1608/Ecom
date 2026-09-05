import { Controller, Get, Param, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly http: HttpService) {}

  @Get(':productId')
  async getStock(@Param('productId') productId: string, @Req() req: Request) {
    const res = await firstValueFrom(
      this.http.get(`${INVENTORY_SERVICE_URL}/${productId}`, {
        headers: { 'x-correlation-id': req.correlationId },
      }),
    );
    return res.data;
  }
}
