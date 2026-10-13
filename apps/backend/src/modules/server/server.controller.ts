import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
// Guards
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
// Services
import { ServerService } from './server.service';

@Controller('servers')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUserServers(@Request() req: any) {
    return this.serverService.getUserServers(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createServer(@Request() req: any, @Body() body: any) {
    return this.serverService.createServer(req.user.sub, body);
  }
}