import { Module } from '@nestjs/common';

import { NodesController, NodesHeartbeatController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeTokenService } from './node-token.service';
import { NodeHeartbeatMonitorService } from './services/node-heartbeat-monitor.service';
import { AgentWebSocketLifecycle } from './transport/agent-websocket.lifecycle';

@Module({
  controllers: [NodesController, NodesHeartbeatController],
  providers: [NodesService, NodeTokenService, NodeHeartbeatMonitorService, AgentWebSocketLifecycle],
  exports: [NodesService, NodeTokenService],
})
export class NodesModule {}
