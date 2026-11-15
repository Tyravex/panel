import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodesService } from '@/modules/nodes/nodes.service';
import { AgentWebSocketLifecycle } from '@/modules/nodes/transport/websocket/agent-websocket.lifecycle';
import { decryptServiceEnvironment } from './service-environment.crypto';
import { sealAgentEnvironment } from './agent-environment-envelope';
import { record } from '@/modules/eggs/catalog/egg-catalog-options';

@Injectable()
export class AgentEnvironmentService {
  constructor(private readonly prisma: PrismaService, private readonly nodes: NodesService, private readonly agent: AgentWebSocketLifecycle) {}

  async deliver(nodeId: string, token: string, commandId: string, sessionId: string) {
    if (!token || !commandId || !sessionId || !await this.nodes.authenticateNode(nodeId, token) || !this.agent.isCurrentNodeSession(nodeId, sessionId)) throw new ForbiddenException('Environment delivery is unavailable');
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.agentCommand.findUnique({ where: { id: commandId }, include: { job: true } });
      if (!command || command.nodeId !== nodeId || command.sessionId !== sessionId || command.operation !== 'service.install' || command.job.type !== 'INSTALL' || !['SENT', 'ACCEPTED'].includes(command.status) || !['QUEUED', 'RUNNING'].includes(command.job.status) || command.job.serviceId !== command.serviceId) throw new ForbiddenException('Environment delivery is unavailable');
      await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${command.serviceId} FOR UPDATE`;
      const service = await tx.service.findUnique({ where: { id: command.serviceId }, include: { eggConfiguration: true } });
      const snapshot = command.job.installConfig;
      if (!service || service.nodeId !== nodeId || !record(snapshot) || snapshot.nodeId !== nodeId || !record(snapshot.egg) || snapshot.egg.id !== service.eggId || !Array.isArray(snapshot.variables) || snapshot.variables.length > 64) throw new ForbiddenException('Environment delivery is unavailable');
      if (service.eggConfiguration && service.eggConfiguration.updatedAt > command.job.createdAt) throw new ForbiddenException('Environment changed after the installation snapshot');
      const values = decryptServiceEnvironment(service.id, service.eggConfiguration?.environmentEncrypted);
      const selected: Record<string, string> = {};
      for (const variable of snapshot.variables) {
        if (!record(variable) || typeof variable.name !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(variable.name) || typeof variable.required !== 'boolean') throw new ForbiddenException('Invalid environment declarations');
        if (variable.required && !values[variable.name]) throw new ForbiddenException('Required environment values are missing');
        if (values[variable.name] !== undefined) selected[variable.name] = values[variable.name];
      }
      // Recheck session ownership immediately before sealing; no values enter job or command records.
      if (!this.agent.isCurrentNodeSession(nodeId, sessionId)) throw new ForbiddenException('Environment delivery is unavailable');
      return sealAgentEnvironment(token, { nodeId, serviceId: service.id, jobId: command.jobId, commandId, sessionId, expiresAt: new Date(Date.now() + 30000).toISOString() }, selected);
    });
  }
}
