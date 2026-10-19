import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsOrigins } from './cors-origins';
import { validateJwtEnvironment } from './env-validation';
import { getRuntimeConfig } from './runtime-config';

async function bootstrap(): Promise<void> {
  // Validate critical secrets before initializing NestJS.
  validateJwtEnvironment();

  // Validate database configuration and listening port.
  const { port } = getRuntimeConfig();

  const corsOrigins = getCorsOrigins();

  const app = await NestFactory.create(AppModule);

  // Reject unknown request fields and transform validated DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable cookie parsing middleware.
  app.use(cookieParser());

  // Restrict credentialed cross-origin requests to configured origins.
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  await app.listen(port);

  console.log(`Server running on port ${port}`);
}

void bootstrap();
