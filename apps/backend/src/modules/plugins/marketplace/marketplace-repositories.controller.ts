import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { CreateMarketplaceRepositoryDto } from './dto/create-marketplace-repository.dto';
import { UpdateMarketplaceRepositoryDto } from './dto/update-marketplace-repository.dto';
import { MarketplaceRepositoriesService } from './marketplace-repositories.service';
import { MarketplaceCommunityRegistryService } from './marketplace-community-registry.service';
import { MarketplaceRegistryService } from './marketplace-registry.service';

@Controller('admin/plugins/marketplace/repositories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class MarketplaceRepositoriesController {
    constructor(
        private readonly repositoriesService: MarketplaceRepositoriesService,
        private readonly communityRegistryService: MarketplaceCommunityRegistryService,
        private readonly officialRegistryService: MarketplaceRegistryService,
    ) { }

    @Get()
    @Header('Cache-Control', 'no-store')
    list() {
        return this.repositoriesService.list();
    }

    @Get(':id')
    @Header('Cache-Control', 'no-store')
    getById(@Param('id') id: string) {
        return this.repositoriesService.getById(id);
    }

    @Get(':id/plugins')
    @Header('Cache-Control', 'no-store')
    async listPlugins(@Param('id') id: string) {
        const repository = await this.repositoriesService.getById(id);

        if (repository.isOfficial) {
            return this.officialRegistryService.getOfficialRegistry();
        }

        return this.communityRegistryService.getRegistry(repository.url);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Header('Cache-Control', 'no-store')
    create(@Body() dto: CreateMarketplaceRepositoryDto) {
        return this.repositoriesService.create(dto);
    }

    @Patch(':id')
    @Header('Cache-Control', 'no-store')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateMarketplaceRepositoryDto,
    ) {
        return this.repositoriesService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Header('Cache-Control', 'no-store')
    async remove(@Param('id') id: string): Promise<void> {
        await this.repositoriesService.remove(id);
    }
}