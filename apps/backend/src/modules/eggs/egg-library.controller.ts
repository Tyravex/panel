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

    private assertPermission(user: UserDTO, permission: string): void {
        if (!user.permissions?.includes(permission)) {
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
        this.assertPermission(req.user, 'egg:read');

        return this.eggsService.listLibraryEggs({
            query,
            page,
            pageSize,
        });
    }

    @Get('stats')
    stats(@Request() req: AuthenticatedRequest) {
        this.assertPermission(req.user, 'egg:read');
        return this.eggsService.getLibraryStats();
    }

    @Get(':id')
    details(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string,
    ) {
        this.assertPermission(req.user, 'egg:read');
        return this.eggsService.getLibraryEgg(id);
    }
}
