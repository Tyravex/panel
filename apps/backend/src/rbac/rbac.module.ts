import { Module } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { DefaultRoleService } from './default-role.service';

@Module({
    controllers: [RbacController],
    providers: [RolesGuard, RbacService, DefaultRoleService],
    exports: [RolesGuard, RbacService],
})
export class RbacModule { }