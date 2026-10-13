import {
  Controller,
  Get,
  UseGuards,
  Request,
  Patch,
  Req,
  Body,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { UsersService } from './users.service';
// Authentication
// Reuse the shared Passport JWT guard across feature modules.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// 
import { UserDTO } from '@shared/types';

// Require authentication for all user-related endpoints.
// JwtStrategy validates the token and attaches the user to req.user.
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  @Patch('preferences')
  async updatePreferences(
    @Req() req: ExpressRequest & { user: UserDTO },
    @Body() data: { language: string },
  ) {
    // JwtAuthGuard has already authenticated the request.
    // Use the validated user ID instead of verifying the JWT again.
    return this.usersService.updatePreferences(req.user.id, data);
  }
}