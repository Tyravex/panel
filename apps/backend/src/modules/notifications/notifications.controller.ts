import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { UserDTO } from '@shared/types';

@Controller('notifications')

@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) { }

  @Get()
  getMy(@Req() req: any) {
    return this.service.findForUser(req.user.id);
  }

  @Patch(':id/read')
  mark(
    @Param('id') id: string,
    @Req() req: Request & { user: UserDTO },
  ) {
    return this.service.markAsRead(Number(id), req.user.id);
  }
}