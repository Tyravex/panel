import { Module } from '@nestjs/common';

import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { AdminServicesService } from './admin-services.service';
import { AdminServicesController } from './admin-services.controller';
import { ServiceEnvironmentService } from './configuration/service-environment.service';
import { ServiceCompatibilityService } from './configuration/service-compatibility.service';
import { NodesModule } from '../nodes/nodes.module';
import { AgentEnvironmentController } from './configuration/agent-environment.controller';
import { AgentEnvironmentService } from './configuration/agent-environment.service';

@Module({
  imports: [NodesModule],
  controllers: [ServicesController, AdminServicesController, AgentEnvironmentController],
  providers: [ServicesService, AdminServicesService, ServiceEnvironmentService, ServiceCompatibilityService, AgentEnvironmentService],
})
export class ServicesModule {}
