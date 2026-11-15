import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import type { UserDTO } from '@shared/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEggRepositoryDto } from './dto/create-egg-repository.dto';
import { SetEggApprovalDto } from './dto/set-egg-approval.dto';
import { EggsService } from './eggs.service';

interface AuthenticatedRequest {
    user: UserDTO;
}

class SetEggRepositoryStatusDto {
    @IsIn(['ENABLED', 'DISABLED'])
    status!: 'ENABLED' | 'DISABLED';
}

class SetEggStatusDto {
    @IsBoolean()
    isEnabled!: boolean;
}

function assertEggPermission(user: UserDTO, permission: string): void {
    if (!user.permissions?.includes(permission)) {
        throw new ForbiddenException('Administrative egg permission required');
    }
}

@Controller('egg-repositories')
@UseGuards(JwtAuthGuard)
export class EggsController {
    constructor(private readonly eggsService: EggsService) { }

    @Get()
    listRepositories(@Request() req: AuthenticatedRequest) {
        assertEggPermission(req.user, 'egg:read');
        return this.eggsService.listRepositories();
    }

    @Post()
    createRepository(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateEggRepositoryDto,
    ) {
        assertEggPermission(req.user, 'egg-repository:manage');
        return this.eggsService.createRepository(req.user.id, dto);
    }

    @Get(':id/eggs')
    listEggs(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
    ) {
        assertEggPermission(req.user, 'egg:read');
        return this.eggsService.listEggs(repositoryId);
    }

    @Post(':id/eggs/import')
    importEgg(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() manifest: unknown,
    ) {
        assertEggPermission(req.user, 'egg:import');
        return this.eggsService.importEgg(req.user.id, repositoryId, manifest);
    }

    @Patch(':id/status')
    setRepositoryStatus(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() dto: SetEggRepositoryStatusDto,
    ) {
        assertEggPermission(req.user, 'egg-repository:manage');
        return this.eggsService.setRepositoryStatus(req.user.id, repositoryId, dto.status);
    }
}

@Controller('eggs')
@UseGuards(JwtAuthGuard)
export class EggStatusController {
    constructor(private readonly eggsService: EggsService) { }

    @Post('custom')
    createCustomEgg(
        @Request() req: AuthenticatedRequest,
        @Body() manifest: unknown,
    ) {
        return this.eggsService.createCustomEgg(req.user.id, manifest);
    }

    @Get('mine')
    listMyEggs(@Request() req: AuthenticatedRequest) {
        return this.eggsService.listMyEggs(req.user.id);
    }

    @Patch(':id/status')
    setEggStatus(
        @Request() req: AuthenticatedRequest,
        @Param('id') eggId: string,
        @Body() dto: SetEggStatusDto,
    ) {
        assertEggPermission(req.user, 'egg:manage');
        return this.eggsService.setEggStatus(req.user.id, eggId, dto.isEnabled);
    }

    @Patch(':id/approval')
    setEggApproval(
        @Request() req: AuthenticatedRequest,
        @Param('id') eggId: string,
        @Body() dto: SetEggApprovalDto,
    ) {
        assertEggPermission(req.user, 'egg:approve');
        return this.eggsService.setEggApproval(req.user.id, eggId, dto.status);
    }
}
