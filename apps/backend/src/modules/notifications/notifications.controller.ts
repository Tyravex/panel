import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { NotificationsGateway } from './notifications.gateway';

@Controller('notifications')

@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) { }

  @Get()
  getMy(@Req() req: any) {
    return this.service.findForUser(req.user.id);
  }

  @Patch(':id/read')
  mark(@Param('id') id: string) {
    return this.service.markAsRead(Number(id));
  }

}

@Controller('test')
export class TestController {
  constructor(private readonly notificationsGateway: NotificationsGateway) { }

  @Get('notify')
  sendTestNotification() {
    this.notificationsGateway.sendToUser(1, {
      id: Date.now(),
      content: '🔥 TEST!',
      createdAt: new Date().toISOString(),
    });

    return { ok: true };
  }
}