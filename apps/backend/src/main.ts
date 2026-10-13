import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Reject unknown request fields and transform validated DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Enable cookie parsing middleware
  app.use(cookieParser());

  // Enable CORS with credentials (required for cookies)
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);

  console.log(
    `Server running on port ${process.env.PORT || 3000}`,
  );
}

bootstrap();