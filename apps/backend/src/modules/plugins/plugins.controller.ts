import {
    BadRequestException,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UnsupportedMediaTypeException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { mapPluginInstallError } from './plugin-install-error.mapper';
import { PluginInstallerService } from './plugin-installer.service';
import { PluginsService } from './plugins.service';

@Controller('admin/plugins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class PluginsController {
    constructor(
        private readonly pluginsService: PluginsService,
        private readonly pluginInstallerService: PluginInstallerService,
    ) { }

    @Get()
    @Header('Cache-Control', 'no-store')
    list() {
        return this.pluginsService.listForAdmin();
    }

    @Post('install')
    @HttpCode(HttpStatus.CREATED)
    @Header('Cache-Control', 'no-store')
    async install(@Req() request: Request) {
        if (!request.is('application/zip')) {
            throw new UnsupportedMediaTypeException(
                'Only ZIP packages are supported.',
            );
        }

        const archive: unknown = request.body;

        if (!Buffer.isBuffer(archive) || archive.length === 0) {
            throw new BadRequestException(
                'A non-empty ZIP archive is required.',
            );
        }

        try {
            return await this.pluginInstallerService.installLanguagePackage(
                archive,
            );
        } catch (error: unknown) {
            throw mapPluginInstallError(error);
        }
    }

    @Get(':id')
    @Header('Cache-Control', 'no-store')
    getOne(@Param('id') id: string) {
        return this.pluginsService.getForAdmin(id);
    }
}
