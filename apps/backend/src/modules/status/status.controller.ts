import { Controller, Get } from '@nestjs/common';
import { StatusService } from './status.service';

@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  async getStatus() {
    return this.statusService.getStatus();
  }

  @Get('health')
  async getHealth() {
    const status = await this.statusService.getStatus();
    return {
      healthy: status.status === 'ok',
      details: status,
    };
  }

}