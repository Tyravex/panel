import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { AgentWebSocketLifecycle } from './transport/websocket/agent-websocket.lifecycle';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { NodesService } from './nodes.service';

@Controller('nodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('node:manage')
export class NodesController {
  constructor(
    private readonly nodesService: NodesService,
    private readonly agentWebSocket: AgentWebSocketLifecycle,
  ) { }

  @Get()
  @Permissions('node:read')
  findAll() {
    return this.nodesService.findAll();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() body: CreateNodeDto) {
    return this.nodesService.createNode(body);
  }

  @Get(':id')
  @Permissions('node:read')
  findOne(@Param('id') id: string) {
    return this.nodesService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateNodeDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.nodesService.updateNode(id, body, req.user.id);
  }
  @Delete(':id')
  @Permissions('node:delete')
  @Header('Cache-Control', 'no-store')
  async remove(
    @Param('id') id: string,
    @Req() req: { user: { id: number } },
  ) {
    const result = await this.nodesService.deleteNode(id, req.user.id);

    this.agentWebSocket.disconnectNode(id);

    return result;
  }
  @Post(':id/rotate-token')
  @Header('Cache-Control', 'no-store')
  async rotateToken(@Param('id') id: string) {
    const result = await this.nodesService.rotateToken(id);

    this.agentWebSocket.disconnectNode(id);

    return result;
  }
}

// Agent-facing endpoint: authenticated by node credentials,
// not by a user session or administrative permissions.
@Controller('nodes')
export class NodesHeartbeatController {
  constructor(private readonly nodesService: NodesService) { }

  @Post(':id/heartbeat')
  @Header('Cache-Control', 'no-store')
  heartbeat(@Param('id') id: string, @Headers('x-node-token') token: string) {
    return this.nodesService.heartbeat(id, token);
  }
}
