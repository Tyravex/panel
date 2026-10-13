import {
  Controller,
  Post,
  Get,
  Res,
  Req,
  Body,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { AuthLoginRequest } from '@shared/types';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(
      body.username,
      body.email,
      body.password,
    );
  }

  @Post('login')
  async login(
    @Body() body: AuthLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.usernameOrEmail || !body?.password) {
      throw new BadRequestException('Missing usernameOrEmail or password');
    }
    // Validate user credentials
    const user = await this.authService.validateUser(
      body.usernameOrEmail,
      body.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const { access_token, refresh_token } =
      await this.authService.login(user);

    // Store access token in HTTP-only cookie (not accessible from JS)
    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // change to true in production (HTTPS)
    });

    // Optional: store refresh token
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // change to true in production (HTTPS)
    });

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: any }) {
    // User is injected by JwtStrategy.validate()
    return req.user;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const { access_token } =
      await this.authService.refreshToken(refreshToken);

    // Issue new access token
    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // change to true in production (HTTPS)
    });

    return { success: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear cookies on logout
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return { message: 'Logged out successfully' };
  }
}