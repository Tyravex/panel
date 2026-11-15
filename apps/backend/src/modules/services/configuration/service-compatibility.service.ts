import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ServiceEnvironmentService } from './service-environment.service';
import type { EggManifest } from '@shared/types';
import { AgentWebSocketLifecycle } from '@/modules/nodes/transport/websocket/agent-websocket.lifecycle';
import { buildInstallCatalog } from '@/modules/eggs/catalog/egg-catalog-options';

@Injectable()
export class ServiceCompatibilityService {
  constructor(private readonly prisma: PrismaService, private readonly environment: ServiceEnvironmentService,
    private readonly agent: AgentWebSocketLifecycle) {}

  async get(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { egg: { include: { repository: true } }, eggConfiguration: { select: { profileId: true, runtimeVersion: true } } } });
    if (!service) throw new NotFoundException('Service not found');
    const blockers: string[] = [];
    if (!service.egg) blockers.push('EGG_REQUIRED');
    if (!service.nodeId) blockers.push('NODE_REQUIRED');
    if (service.egg && (!service.egg.isEnabled || service.egg.approvalStatus !== 'APPROVED' || service.egg.repository.status !== 'ENABLED')) blockers.push('EGG_UNAVAILABLE');
    const catalog = (service.egg?.manifest as unknown as EggManifest | undefined)?.catalog;
    const metadata = await this.environment.metadata(serviceId);
    if (metadata.missing.length) blockers.push('REQUIRED_VARIABLES_MISSING');
    const capabilities = service.nodeId ? this.agent.getNodeCapabilities(service.nodeId) : [];
    const requiredCapabilities = catalog ? ['service.install.v2', 'service.environment.secure.v1', 'service.disk-quota.v1'] : ['service.install.v1', 'service.disk-quota.v1'];
    if (!requiredCapabilities.every((entry) => capabilities.includes(entry))) blockers.push('AGENT_INSTALL_EXECUTION_UNAVAILABLE');
    // The current dispatcher only handles legacy Server jobs. A capable Agent alone cannot enable this path.
    blockers.push('PANEL_INSTALL_DISPATCH_UNAVAILABLE');
    return { ready: blockers.length === 0, contractVersion: catalog ? 2 : 1, blockers, missingVariables: metadata.missing,
      requiredCapabilities, agentCapabilities: capabilities, nodeConnected: !!service.nodeId && this.agent.isNodeConnected(service.nodeId),
      catalog: service.egg ? buildInstallCatalog(service.egg.manifest as unknown as EggManifest, {
        profileId: service.eggConfiguration?.profileId ?? undefined, runtimeVersion: service.eggConfiguration?.runtimeVersion ?? undefined,
      }) : null };
  }

  async updates(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { egg: true } });
    if (!service) throw new NotFoundException('Service not found');
    if (!service.egg) return [];
    if (!/^\d+\.\d+\.\d+$/.test(service.egg.version)) return [];
    const current = service.egg.version.split('.').map(BigInt);
    const candidates = await this.prisma.egg.findMany({ where: { repositoryId: service.egg.repositoryId, key: service.egg.key, isEnabled: true, approvalStatus: 'APPROVED', repository: { status: 'ENABLED' } },
      select: { id: true, name: true, version: true } });
    return candidates.filter((entry) => {
      if (!/^\d+\.\d+\.\d+$/.test(entry.version)) return false;
      const next = entry.version.split('.').map(BigInt);
      for (let index = 0; index < 3; index++) { if (next[index] > current[index]) return true; if (next[index] < current[index]) return false; }
      return false;
    });
  }
}
