import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async updatePreferences(
    userId: number,
    data: { language?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { language: data.language },
      select: {
        id: true,
        username: true,
        email: true,
        language: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByUsernameOrEmail(usernameOrEmail: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
    });
  }

  async validatePassword(user: any, password: string) {
    return bcrypt.compare(password, user.password);
  }

  async createUser(username: string, email: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { username, email, password: hashed },
    });
  }
}