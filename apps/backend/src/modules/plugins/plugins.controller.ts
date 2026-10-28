import {
    Controller,
    Get,
    Header,
    Param,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PluginsService } from './plugins.service';

@Controller('admin/plugins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class PluginsController {
    constructor(
        private readonly pluginsService: PluginsService,
    ) { }

    @Get()
    @Header('Cache-Control', 'no-store')
    list() {
        return this.pluginsService.listForAdmin();
    }

    @Get(':id')
    @Header('Cache-Control', 'no-store')
    getOne(@Param('id') id: string) {
        return this.pluginsService.getForAdmin(id);
    }
}
