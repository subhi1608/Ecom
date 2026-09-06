import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// Fail fast at boot rather than on the first authenticated request. The
// gateway verifies tokens auth-service signed, so a missing/mismatched
// secret here means every login silently 401s instead of failing loudly.
function assertRequiredEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. api-gateway verifies tokens signed by auth-service ' +
        'with this exact value — refusing to start.',
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();
  const app = await NestFactory.create(AppModule);

  // Let in-flight requests finish (and OnModuleDestroy hooks run) on
  // SIGTERM/SIGINT instead of the process dying mid-request.
  app.enableShutdownHooks();

  // Required for JwtAuthGuard to read the auth cookie off the request.
  // Without this, request.cookies is undefined and every guarded route 401s.
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3000);
  console.log(`api-gateway listening on port ${process.env.PORT || 3000}`);
}
bootstrap();
