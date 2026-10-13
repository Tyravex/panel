import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UserDTO } from '@shared/types';
import { Request as ExpressRequest } from 'express';

type AuthenticatedRequest = ExpressRequest & {
  user: UserDTO;
};

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() data: CreateJobDto,
  ) {
    // The authenticated user ID must come from the validated JWT.
    return this.jobsService.create(req.user.id, data);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    // Return only jobs owned by the authenticated user.
    return this.jobsService.findAllForUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    // JobsService scopes the lookup to the authenticated user.
    return this.jobsService.findOneForUser(req.user.id, id);
  }
}