import { Body, Controller, Param, Post, Req, Header, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AgentEnvironmentService } from './agent-environment.service';

@Controller('agent/nodes/:nodeId/environment')
export class AgentEnvironmentController {
  constructor(private readonly environment: AgentEnvironmentService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async deliver(@Param('nodeId') nodeId: string, @Req() request: Request, @Body() body: unknown) {
    // req.secure respects only Express's explicitly configured trusted proxies.
    if (!request.secure) throw new ForbiddenException('HTTPS is required for environment delivery');
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer [a-f0-9]{64}$/i.test(authorization)) throw new ForbiddenException('Agent authentication required');
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['commandId', 'sessionId'].includes(key))) throw new ForbiddenException('Invalid delivery binding');
    const { commandId, sessionId } = body as Record<string, unknown>;
    if (typeof commandId !== 'string' || typeof sessionId !== 'string' || commandId.length > 128 || sessionId.length > 128) throw new ForbiddenException('Invalid delivery binding');
    return this.environment.deliver(nodeId, authorization.slice(7), commandId, sessionId);
  }
}
