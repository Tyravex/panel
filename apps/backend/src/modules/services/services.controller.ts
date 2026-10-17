import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';

import { UserDTO } from '@shared/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from './services.service';

interface AuthenticatedRequest {
  user: UserDTO;
}

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
  ) {}

  @Get()
  getUserServices(@Request() req: AuthenticatedRequest) {
    // Resolve the owner from the authenticated JWT session.
    return this.servicesService.getUserServices(req.user.id);
  }
}
