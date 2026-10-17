import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { JWTPayload, UserDTO } from '@shared/types';

const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JWTPayload): Promise<UserDTO> {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid access token type');
    }

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid user identity');
    }

    if (typeof payload.sid !== 'string' || !payload.sid) {
      throw new UnauthorizedException('Missing session ID');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });

    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    // Reject disabled users even when their access token is still valid.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account disabled');
    }

    const roles = user.roles.map((membership) => membership.role.name);

    const permissions = [
      ...new Set(
        user.roles.flatMap((membership) =>
          membership.role.permissions.map((permission) => permission.name),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      language: user.language,
      roles,
      permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
