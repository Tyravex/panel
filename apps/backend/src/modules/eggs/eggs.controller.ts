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

function assertEggAdministrator(user: UserDTO): void {
    if (
        !user.roles?.includes('Owner') ||
        !user.permissions?.includes('service:manage:any')
    ) {
        throw new ForbiddenException('Administrative egg permission required');
    }
}

@Controller('egg-repositories')
@UseGuards(JwtAuthGuard)
export class EggsController {
    constructor(private readonly eggsService: EggsService) { }

    @Get()
    listRepositories(@Request() req: AuthenticatedRequest) {
        assertEggAdministrator(req.user);
        return this.eggsService.listRepositories();
    }

    @Post()
    createRepository(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateEggRepositoryDto,
    ) {
        assertEggAdministrator(req.user);
        return this.eggsService.createRepository(req.user.id, dto);
    }

    @Get(':id/eggs')
    listEggs(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
    ) {
        assertEggAdministrator(req.user);
        return this.eggsService.listEggs(repositoryId);
    }

    @Post(':id/eggs/import')
    importEgg(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() manifest: unknown,
    ) {
        assertEggAdministrator(req.user);
        return this.eggsService.importEgg(req.user.id, repositoryId, manifest);
    }

    @Patch(':id/status')
    setRepositoryStatus(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() dto: SetEggRepositoryStatusDto,
    ) {
        assertEggAdministrator(req.user);
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
        assertEggAdministrator(req.user);
        return this.eggsService.setEggStatus(req.user.id, eggId, dto.isEnabled);
    }

    @Patch(':id/approval')
    setEggApproval(
        @Request() req: AuthenticatedRequest,
        @Param('id') eggId: string,
        @Body() dto: SetEggApprovalDto,
    ) {
        assertEggAdministrator(req.user);
        return this.eggsService.setEggApproval(req.user.id, eggId, dto.status);
    }
}
