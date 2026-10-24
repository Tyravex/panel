import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JobType } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { UserDTO } from '@shared/types';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ServiceJobsService } from './service-jobs.service';

class CreateServiceJobDto {
    @IsEnum(JobType)
    type!: JobType;
}

type AuthenticatedRequest = ExpressRequest & {
    user: UserDTO;
};

@Controller('services/:serviceId/jobs')
@UseGuards(JwtAuthGuard)
export class ServiceJobsController {
    constructor(
        private readonly serviceJobsService: ServiceJobsService,
    ) { }

    @Get('active')
    getActive(
        @Request() req: AuthenticatedRequest,
        @Param('serviceId') serviceId: string,
    ) {
        return this.serviceJobsService.getActive(
            req.user.id,
            serviceId,
        );
    }

    @Post()
    create(
        @Request() req: AuthenticatedRequest,
        @Param('serviceId') serviceId: string,
        @Body() dto: CreateServiceJobDto,
    ) {
        return this.serviceJobsService.create(
            req.user.id,
            serviceId,
            dto.type,
        );
    }
}
