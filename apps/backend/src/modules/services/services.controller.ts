import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { UserDTO } from '@shared/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetServiceMemberDto, UpdateServiceMemberDto } from './dto/service-member.dto';
import { ServicesService } from './services.service';

interface AuthenticatedRequest {
  user: UserDTO;
}

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  getUserServices(@Request() req: AuthenticatedRequest) {
    return this.servicesService.getUserServices(req.user.id);
  }

  @Get(':id/members')
  getMembers(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string) {
    return this.servicesService.getMembers(serviceId, req.user.id);
  }

  @Post(':id/members')
  addMember(
    @Request() req: AuthenticatedRequest,
    @Param('id') serviceId: string,
    @Body() dto: SetServiceMemberDto,
  ) {
    return this.servicesService.addMember(serviceId, req.user.id, dto);
  }

  @Patch(':id/members/:userId')
  updateMember(
    @Request() req: AuthenticatedRequest,
    @Param('id') serviceId: string,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Body() dto: UpdateServiceMemberDto,
  ) {
    return this.servicesService.updateMember(serviceId, req.user.id, memberUserId, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Request() req: AuthenticatedRequest,
    @Param('id') serviceId: string,
    @Param('userId', ParseIntPipe) memberUserId: number,
  ) {
    return this.servicesService.removeMember(serviceId, req.user.id, memberUserId);
  }
}
