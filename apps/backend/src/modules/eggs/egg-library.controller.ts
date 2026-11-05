import {
    Controller,
    ForbiddenException,
    Get,
    Param,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { UserDTO } from '@shared/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EggsService } from './eggs.service';

interface AuthenticatedRequest {
    user: UserDTO;
}

@Controller('eggs/library')
@UseGuards(JwtAuthGuard)
export class EggLibraryController {
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
    list(
        @Request() req: AuthenticatedRequest,
        @Query('query') query?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        this.assertAdmin(req.user);

        return this.eggsService.listLibraryEggs({
            query,
            page,
            pageSize,
        });
    }

    @Get('stats')
    stats(@Request() req: AuthenticatedRequest) {
        this.assertAdmin(req.user);
        return this.eggsService.getLibraryStats();
    }

    @Get(':id')
    details(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string,
    ) {
        this.assertAdmin(req.user);
        return this.eggsService.getLibraryEgg(id);
    }
}
