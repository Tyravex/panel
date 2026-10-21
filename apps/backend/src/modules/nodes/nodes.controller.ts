import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { CreateNodeDto } from './dto/create-node.dto';
import { NodesService } from './nodes.service';

@Controller('nodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('node:manage')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  findAll() {
    return this.nodesService.findAll();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() body: CreateNodeDto) {
    return this.nodesService.createNode(body.name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nodesService.findById(id);
  }

  @Post(':id/rotate-token')
  @Header('Cache-Control', 'no-store')
  rotateToken(@Param('id') id: string) {
    return this.nodesService.rotateToken(id);
  }
}

// Agent-facing endpoint: authenticated by node credentials,
// not by a user session or administrative permissions.
@Controller('nodes')
export class NodesHeartbeatController {
  constructor(private readonly nodesService: NodesService) {}

  @Post(':id/heartbeat')
  @Header('Cache-Control', 'no-store')
  heartbeat(@Param('id') id: string, @Headers('x-node-token') token: string) {
    return this.nodesService.heartbeat(id, token);
  }
}
