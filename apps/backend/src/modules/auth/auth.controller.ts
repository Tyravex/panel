import {
  Controller, Post, Get, Res, Req, Body, UseGuards,
  UnauthorizedException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegistrationSettingsService } from './registration-settings.service';
import { RegistrationRateLimitGuard } from './guards/registration-rate-limit.guard';
import { Response, Request } from 'express';
import { AuthLoginRequest } from '@shared/types';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { validateRegistrationInput } from './registration-input.validator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registrationSettings?: RegistrationSettingsService,
  ) { }

  @Get('registration-settings')
  async registrationStatus() {
    return { enabled: await this.registrationSettings?.isRegistrationEnabled() };
  }

  @UseGuards(RegistrationRateLimitGuard)
  @Post('register')
  async register(@Body() body: any) {
    // Check the stored setting before any user creation attempt.
    if (!(await this.registrationSettings?.isRegistrationEnabled())) {
      throw new ForbiddenException('Public registration is disabled');
    }
    const validated = validateRegistrationInput(body);
    return this.authService.register(
      validated.username,
      validated.email,
      validated.password,
      validated.firstName,
      validated.lastName,
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
    const user = await this.authService.validateUser(body.usernameOrEmail, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const { access_token, refresh_token } = await this.authService.login(user);
    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: any }) {
    return req.user;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const { access_token } = await this.authService.refreshToken(refreshToken);
    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { success: true };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    const accessToken = req.cookies?.access_token;
    try {
      if (typeof refreshToken === 'string' && refreshToken) {
        try {
          await this.authService.logout(refreshToken);
          return { message: 'Logged out successfully' };
        } catch (error) {
          if (!(error instanceof UnauthorizedException)) throw error;
        }
      }
      if (typeof accessToken === 'string' && accessToken) {
        await this.authService.logoutWithAccessToken(accessToken);
      }
      return { message: 'Logged out successfully' };
    } finally {
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
    }
  }
}
