import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsOrigins } from './cors-origins';
import { validateJwtEnvironment } from './env-validation';
import { getRuntimeConfig } from './runtime-config';
import { AgentWebSocketLifecycle } from './modules/nodes/transport/agent-websocket.lifecycle';
import { AgentCommandRecoveryService } from './modules/nodes/transport/agent-command-recovery.service';

async function bootstrap(): Promise<void> {
  // Validate critical secrets before initializing NestJS.
  validateJwtEnvironment();

  // Validate database configuration and listening port.
  const { port } = getRuntimeConfig();

  const corsOrigins = getCorsOrigins();

  const app = await NestFactory.create(AppModule);

  try {
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

    // Initialize NestJS providers and establish the Prisma connection
    // before attempting command recovery.
    await app.init();

    // Recover uncertain command outcomes before accepting any new
    // Agent WebSocket connections.
    //
    // Recovery never re-dispatches a command. If it fails, startup
    // must stop rather than allow new commands to race with recovery.
    const recovery = app.get(AgentCommandRecoveryService);
    const recoveryResult = await recovery.recoverAll();

    console.log(
      'Agent command recovery completed:',
      recoveryResult,
    );

    // Attach the Agent transport only after durable recovery succeeds.
    app.get(AgentWebSocketLifecycle).attach(
      app.getHttpServer(),
    );

    app.enableShutdownHooks();

    await app.listen(port);

    console.log(`Server running on port ${port}`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap();
