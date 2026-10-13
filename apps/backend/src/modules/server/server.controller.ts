import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
// Authentication
// Shared Passport JWT guard supports cookies and Bearer tokens.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Services
import { ServerService } from './server.service';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Get()
  getUserServers(@Request() req: any) {
    // JwtStrategy attaches the authenticated user to req.user.
    return this.serverService.getUserServers(req.user.id);
  }

  @Post()
  createServer(@Request() req: any, @Body() body: any) {
    // Always use the authenticated user's ID, not an ID from the request body.
    return this.serverService.createServer(req.user.id, body);
  }
}