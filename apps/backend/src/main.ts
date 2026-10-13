import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //
  app.useGlobalPipes(new ValidationPipe());
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