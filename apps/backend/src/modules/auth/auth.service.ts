import * as bcrypt from 'bcryptjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenResponse, JWTPayload, UserDTO } from '@shared/types';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsGateway: NotificationsGateway,
  ) { }

  async validateUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<UserDTO | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: usernameOrEmail },
          { username: usernameOrEmail },
        ],
      },
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

    // Disabled accounts cannot authenticate.
    if (!user || !user.isActive) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return this.toUserDTO(user);
  }

  async login(user: UserDTO): Promise<AuthTokenResponse> {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET missing');
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      sid: session.id,
    };

    const access_token = this.jwtService.sign(
      {
        ...payload,
        tokenType: 'access',
      },
      {
        expiresIn: '1h',
      },
    );

    const refresh_token = this.jwtService.sign(
      {
        ...payload,
        tokenType: 'refresh',
      },
      {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    return { access_token, refresh_token, user };
  }

  async refreshToken(refreshToken: string) {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET missing');
    }

    try {
      const payload = this.jwtService.verify<JWTPayload>(refreshToken, {
        secret: refreshSecret,
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      const userId = Number(payload.sub);

      if (
        !Number.isSafeInteger(userId) ||
        userId <= 0 ||
        typeof payload.sid !== 'string' ||
        !payload.sid
      ) {
        throw new UnauthorizedException('Invalid refresh token');
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

      // A valid session cannot restore access to a disabled account.
      const account = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });
      if (!account?.isActive) {
        throw new UnauthorizedException('Account disabled');
      }

      const access_token = this.jwtService.sign({
        sub: userId,
        email: payload.email,
        sid: session.id,
        tokenType: 'access',
      });

      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<UserDTO> {
    const hashed = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
      },
    });

    return this.toUserDTO(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET missing');
    }

    let payload: JWTPayload;

    try {
      payload = this.jwtService.verify<JWTPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    await this.revokeSession(payload);
  }

  async logoutWithAccessToken(accessToken: string): Promise<void> {
    const accessSecret = process.env.JWT_SECRET;

    if (!accessSecret) {
      throw new Error('JWT_SECRET missing');
    }

    let payload: JWTPayload;

    try {
      payload = this.jwtService.verify<JWTPayload>(accessToken, {
        secret: accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid access token type');
    }

    await this.revokeSession(payload);
  }

  private async revokeSession(payload: JWTPayload): Promise<void> {
    const userId = Number(payload.sub);

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof payload.sid !== 'string' ||
      !payload.sid
    ) {
      throw new UnauthorizedException('Invalid session identity');
    }

    const result = await this.prisma.session.updateMany({
      where: {
        id: payload.sid,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Invalid session');
    }

    // Disconnect sockets only after successful database revocation.
    this.notificationsGateway.disconnectSession(payload.sid);
  }

  // Map a database user to a public DTO without exposing credentials.
  private toUserDTO(user: any): UserDTO {
    const memberships = Array.isArray(user.roles)
      ? user.roles
      : [];

    const roles: string[] = memberships.map(
      (membership: any) => membership.role.name,
    );

    const permissions: string[] = [
      ...new Set<string>(
        memberships.flatMap((membership: any) =>
          membership.role.permissions.map(
            (permission: any) => permission.name as string,
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      language: user.language,
      roles,
      permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
