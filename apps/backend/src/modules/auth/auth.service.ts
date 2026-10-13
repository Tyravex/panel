import * as bcrypt from 'bcryptjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenResponse, UserDTO } from '@shared/types';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) return null;

    // Compare hashed password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return this.toUserDTO(user);
  }

  async login(user: UserDTO): Promise<AuthTokenResponse> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    // Short-lived access token
    const access_token = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    // Long-lived refresh token (different secret!)
    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    return {
      access_token,
      refresh_token,
      user,
    };
  }

  async refreshToken(refreshToken: string) {

    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET missing');
    }

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Issue new access token
      const access_token = this.jwtService.sign({
        sub: payload.sub,
        email: payload.email,
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

  // Maps Prisma user → clean DTO (no password leakage)
  private toUserDTO(user: any): UserDTO {
    return {
      id: Number(user.id),
      email: user.email,
      username: user.username,
      role: user.role?.name ?? null,
      permissions:
        user.role?.permissions.map((p: any) => p.name) ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}