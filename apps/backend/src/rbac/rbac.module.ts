import { Module } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
    controllers: [RbacController],
    providers: [RolesGuard, RbacService],
    exports: [RolesGuard, RbacService],
})
export class RbacModule {}