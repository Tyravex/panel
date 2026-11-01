import {
    Controller,
    Get,
    Header,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { MarketplaceRegistryService } from './marketplace-registry.service';

@Controller('admin/plugins/marketplace')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class MarketplaceController {
    constructor(
        private readonly registryService: MarketplaceRegistryService,
    ) { }

    @Get()
    @Header('Cache-Control', 'no-store')
    list() {
        return this.registryService.getOfficialRegistry();
    }
}