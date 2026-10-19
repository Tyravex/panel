
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsOrigins } from './cors-origins';

async function bootstrap(): Promise<void> {
  const corsOrigins = getCorsOrigins();
  const port = Number(process.env.PORT || 3000);

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
