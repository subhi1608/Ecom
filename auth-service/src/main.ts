import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Fail fast at boot rather than at the first login request. Without this the
// missing-secret failure surfaces as a 500 under live traffic; a code review
// flagged that `process.env.JWT_SECRET` is cast to string in AuthService,
// which silences the compiler but not the actual risk.
function assertRequiredEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. auth-service signs tokens with it, and api-gateway ' +
        'and order-service verify against the same value — refusing to start.',
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule);

  // Drain in-flight requests on SIGTERM/SIGINT instead of dying mid-request.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3005);
  console.log(`auth-service listening on port ${process.env.PORT || 3005}`);
}
bootstrap();
