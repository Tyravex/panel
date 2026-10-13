import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { Request } from 'express';
import { JWTPayload, UserDTO } from '@shared/types';

/**
 * Custom extractor to read JWT from cookies instead of Authorization header
 */
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token || null;
};

// console.log('JWT_SECRET STRATEGY:', process.env.JWT_SECRET);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not defined');

    super({
      //
     jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      //
      ignoreExpiration: false,
      secretOrKey: secret,
      //passReqToCallback: true,
    });
  }

  /**
   * This method is called after JWT is verified
   * Its return value is attached to req.user
   */
  async validate(payload: JWTPayload): Promise<UserDTO> {
    // Fetch full user with role + permissions
    const user = await this.prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      // include: {
      //   role: {
      //     include: {
      //       permissions: true,
      //     },
      //   },
      // },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Map to safe DTO (no password)
    return {
      id: Number(user.id),
      email: user.email,
      username: user.username,

      language: user.language,

      //role: user.role?.name ?? null,
      // permissions:
      //   user.role?.permissions.map((p: { name: string }) => p.name) ?? [],

      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}