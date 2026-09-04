import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  // httpAdapterHost lets the filter work regardless of the underlying
  // platform (Express here) without importing Express types directly.
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Only handle HTTP-context exceptions here. If the error came from an
    // RMQ event handler (host.getType() === 'rpc'), there is no HTTP
    // response to send — re-throw so the microservice transport handles
    // the ack/nack instead of us trying to write a response to nothing.
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // For HttpExceptions, use their structured message (e.g. the array of
    // validation errors from ValidationPipe). Otherwise a generic message —
    // never leak an internal error's raw text/stack to the client.
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const correlationId = request.headers?.['x-correlation-id'] || 'none';

    // Log the FULL detail server-side (including stack), keyed by correlation
    // ID so you can trace it — but don't send that detail to the client.
    this.logger.error(
      `[${correlationId}] ${request.method} ${httpAdapter.getRequestUrl(request)} -> ${httpStatus}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const responseBody = {
      statusCode: httpStatus,
      message,
      path: httpAdapter.getRequestUrl(request),
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}