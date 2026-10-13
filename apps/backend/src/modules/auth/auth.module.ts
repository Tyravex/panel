
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Authentication components
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule,

    // Configure JWT signing for authentication tokens.
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],

  controllers: [AuthController],

  // PrismaService is already available globally through PrismaModule.
  // Register only providers owned by the authentication module.
  providers: [AuthService, JwtStrategy, JwtAuthGuard],

  // Allow other modules to reuse JWT authentication.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}