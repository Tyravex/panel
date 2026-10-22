import {
  Body, Controller, Delete, ForbiddenException, Get, Param,
  ParseIntPipe, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import { UserDTO } from '@shared/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { SetServiceOwnerDto } from './dto/set-service-owner.dto';
import { SetServiceMemberDto, UpdateServiceMemberDto } from './dto/service-member.dto';
import { ServicesService } from './services.service';

interface AuthenticatedRequest { user: UserDTO; }

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) { }

  @Get()
  getUserServices(@Request() req: AuthenticatedRequest) {
    return this.servicesService.getUserServices(req.user.id);
  }

  @Get('admin/all')
  getAllServices(@Request() req: AuthenticatedRequest) {
    this.assertAdmin(req.user, 'service:manage:any');
    return this.servicesService.getAllServices();
  }

  @Post()
  createService(@Request() req: AuthenticatedRequest, @Body() dto: CreateServiceDto) {
    this.assertAdmin(req.user, 'service:create');
    return this.servicesService.createService(req.user.id, dto);
  }

  @Patch(':id/owner')
  setOwner(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string,
    @Body() dto: SetServiceOwnerDto) {
    this.assertAdmin(req.user, 'service:manage:any');
    return this.servicesService.setOwner(serviceId, req.user.id, dto);
  }

  private assertAdmin(user: UserDTO, permission: string): void {
    // A permission alone is insufficient: service administration requires a staff role.
    if (!user.roles?.includes('Owner') || !user.permissions?.includes(permission)) {
      throw new ForbiddenException('Administrative service permission required');
    }
  }

  @Get(':id/members')
  getMembers(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string) {
    return this.servicesService.getMembers(serviceId, req.user.id);
  }

  @Post(':id/members')
  addMember(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string,
    @Body() dto: SetServiceMemberDto) {
    return this.servicesService.addMember(serviceId, req.user.id, dto);
  }

  @Patch(':id/members/:userId')
  updateMember(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Body() dto: UpdateServiceMemberDto) {
    return this.servicesService.updateMember(serviceId, req.user.id, memberUserId, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(@Request() req: AuthenticatedRequest, @Param('id') serviceId: string,
    @Param('userId', ParseIntPipe) memberUserId: number) {
    return this.servicesService.removeMember(serviceId, req.user.id, memberUserId);
  }
}
