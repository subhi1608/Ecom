import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Request } from 'express';
import { buildForwardedHeaders } from '../common/request-headers';
import { translateProxyError } from '../common/proxy-error';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

const REQUEST_TIMEOUT_MS = 5000;

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly http: HttpService) {}

  @Get(':productId')
  async getStock(@Param('productId') productId: string, @Req() req: Request) {
    try {
      const res = await firstValueFrom(
        this.http
          .get(`${INVENTORY_SERVICE_URL}/${productId}`, {
            headers: buildForwardedHeaders(req.correlationId),
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
      );
      return res.data;
    } catch (err) {
      // Same reason as the orders proxy: an untranslated AxiosError reaches
      // AllExceptionsFilter as a blanket 500, so an unknown product would
      // read as a server fault rather than a 404.
      throw translateProxyError(err);
    }
  }
}
