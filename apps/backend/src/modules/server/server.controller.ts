import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServerService } from './server.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UserDTO } from '@shared/types';

interface AuthenticatedRequest {
  user: UserDTO;
}

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServerController {
  constructor(
    private readonly serverService: ServerService,
  ) { }

  @Get()
  getUserServers(@Request() req: AuthenticatedRequest) {
    return this.serverService.getUserServers(req.user.id);
  }

  @Post()
  createServer(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateServerDto,
  ) {
    // Server provisioning requires an explicit global permission.
    if (!req.user.permissions.includes('server:create')) {
      throw new ForbiddenException(
        'You do not have permission to create servers',
      );
    }

    // Authorized staff selects the server's assigned owner.
    return this.serverService.createServer(
      body.userId,
      body.name,
    );
  }
}