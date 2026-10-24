import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { NodesController, NodesHeartbeatController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeTokenService } from './node-token.service';
import { NodeHeartbeatMonitorService } from './services/node-heartbeat-monitor.service';
import { AgentCommandsService } from './transport/agent-commands.service';
import { AgentCommandRecoveryService } from './transport/agent-command-recovery.service';
import { AgentWebSocketLifecycle } from './transport/agent-websocket.lifecycle';

@Module({
  controllers: [
    NodesController,
    NodesHeartbeatController,
  ],
  providers: [
    NodesService,
    NodeTokenService,
    NodeHeartbeatMonitorService,
    {
      provide: AgentCommandsService,
      useFactory: (prisma: PrismaService) =>
        new AgentCommandsService(prisma),
      inject: [PrismaService],
    },
    {
      provide: AgentCommandRecoveryService,
      useFactory: (
        prisma: PrismaService,
        commandsService: AgentCommandsService,
      ) =>
        new AgentCommandRecoveryService(
          prisma,
          commandsService,
        ),
      inject: [
        PrismaService,
        AgentCommandsService,
      ],
    },
    AgentWebSocketLifecycle,
  ],
  exports: [
    NodesService,
    NodeTokenService,
  ],
})
export class NodesModule { }
