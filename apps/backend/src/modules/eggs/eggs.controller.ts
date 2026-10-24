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
import {
    IsBoolean,
    IsIn,
} from 'class-validator';

import { UserDTO } from '@shared/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEggRepositoryDto } from './dto/create-egg-repository.dto';
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

@Controller('egg-repositories')
@UseGuards(JwtAuthGuard)
export class EggsController {
    constructor(private readonly eggsService: EggsService) { }

    private assertAdmin(user: UserDTO): void {
        if (
            !user.roles?.includes('Owner') ||
            !user.permissions?.includes('service:manage:any')
        ) {
            throw new ForbiddenException(
                'Administrative egg permission required',
            );
        }
    }

    @Get()
    listRepositories(
        @Request() req: AuthenticatedRequest,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.listRepositories();
    }

    @Post()
    createRepository(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreateEggRepositoryDto,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.createRepository(req.user.id, dto);
    }

    @Get(':id/eggs')
    listEggs(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.listEggs(repositoryId);
    }

    @Post(':id/eggs/import')
    importEgg(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() manifest: unknown,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.importEgg(
            req.user.id,
            repositoryId,
            manifest,
        );
    }

    @Patch(':id/status')
    setRepositoryStatus(
        @Request() req: AuthenticatedRequest,
        @Param('id') repositoryId: string,
        @Body() dto: SetEggRepositoryStatusDto,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.setRepositoryStatus(
            req.user.id,
            repositoryId,
            dto.status,
        );
    }
}

@Controller('eggs')
@UseGuards(JwtAuthGuard)
export class EggStatusController {
    constructor(private readonly eggsService: EggsService) { }

    @Patch(':id/status')
    setEggStatus(
        @Request() req: AuthenticatedRequest,
        @Param('id') eggId: string,
        @Body() dto: SetEggStatusDto,
    ) {
        if (
            !req.user.roles?.includes('Owner') ||
            !req.user.permissions?.includes('service:manage:any')
        ) {
            throw new ForbiddenException(
                'Administrative egg permission required',
            );
        }

        return this.eggsService.setEggStatus(
            req.user.id,
            eggId,
            dto.isEnabled,
        );
    }
}
