import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { UserDTO } from '@shared/types';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { EggTagsService } from './egg-tags.service';

@Controller('egg-tags')
@UseGuards(JwtAuthGuard)
export class EggTagsController {
  constructor(private readonly tags: EggTagsService) {}
  @Get() list(@Req() req: { user: UserDTO }) { return this.tags.list(req.user); }
  @Get('eggs/:id') forEgg(@Req() req: { user: UserDTO }, @Param('id') id: string) { return this.tags.forEgg(req.user, id); }
  @Post() create(@Req() req: { user: UserDTO }, @Body() body: unknown) { return this.tags.create(req.user, body); }
  @Patch(':id') update(@Req() req: { user: UserDTO }, @Param('id') id: string, @Body() body: unknown) { return this.tags.update(req.user, id, body); }
  @Delete(':id') remove(@Req() req: { user: UserDTO }, @Param('id') id: string) { return this.tags.remove(req.user, id); }
  @Put('eggs/:id') assign(@Req() req: { user: UserDTO }, @Param('id') id: string, @Body() body: { tagIds?: unknown }) { return this.tags.assign(req.user, id, body?.tagIds); }
}
