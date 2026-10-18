import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RegistrationSettingsService } from './registration-settings.service';
import { RegistrationSettingsController } from './registration-settings.controller';
import { RegistrationRateLimitGuard } from './guards/registration-rate-limit.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { RegistrationRateLimitStore } from './registration-rate-limit.store';

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController, RegistrationSettingsController],
  providers: [AuthService, RegistrationSettingsService, RegistrationRateLimitGuard, JwtStrategy, JwtAuthGuard, PermissionsGuard, RegistrationRateLimitStore ],
  exports: [JwtModule, JwtAuthGuard, RegistrationSettingsService],
})
export class AuthModule { }
