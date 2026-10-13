import { Controller, Get, UseGuards, Request, Patch, Req, Body } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import * as jwt from 'jsonwebtoken';
import { UserDTO } from '@shared/types';

interface RequestWithCookies extends ExpressRequest {
  cookies: { [key: string]: string };
}

@Controller('user')
export class UserController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  @Patch('preferences')
  async updatePreferences(@Req() req: RequestWithCookies, @Body() data: { language: string }) {
    try {
      const token = req.cookies['access_token'];
      if (!token) throw new Error('No token found');

      const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

      const userId = payload.sub;
      if (!userId) throw new Error('User ID not found in token');

      return this.usersService.updatePreferences(Number(userId), data);
    } catch (err) {
      return { error: err };
    }
  }
}