import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;

function validateProfileName(value: unknown, field: string): string | null {
  if (value === null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.length > 80 ||
    value.trim() !== value ||
    !namePattern.test(value)
  ) {
    throw new BadRequestException(`Invalid ${field}`);
  }

  return value;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: number, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid profile input');
    }

    const fields = input as Record<string, unknown>;
    const keys = Object.keys(fields);

    if (
      keys.length === 0 ||
      keys.some((key) => !['firstName', 'lastName'].includes(key))
    ) {
      throw new BadRequestException('Unexpected profile field');
    }

    const data: {
      firstName?: string | null;
      lastName?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(fields, 'firstName')) {
      data.firstName = validateProfileName(fields.firstName, 'firstName');
    }

    if (Object.prototype.hasOwnProperty.call(fields, 'lastName')) {
      data.lastName = validateProfileName(fields.lastName, 'lastName');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        language: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updatePreferences(userId: number, input: unknown) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      throw new BadRequestException('Invalid preferences input');
    }

    const fields = input as Record<string, unknown>;
    const keys = Object.keys(fields);

    if (
      keys.length !== 1 ||
      keys[0] !== 'language' ||
      typeof fields.language !== 'string'
    ) {
      throw new BadRequestException('Invalid language preference');
    }

    const language = fields.language;

    // Accept language tags such as pl, en, de, en-US, pt-BR.
    // The set of available languages can grow through plugins.
    if (
      language.length > 35 ||
      !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language)
    ) {
      throw new BadRequestException('Invalid language code');
    }

    // Only allow languages currently enabled in the registry.
    // Community languages become available after admin activation.
    const availableLanguage = await this.prisma.language.findFirst({
      where: {
        code: language,
        isEnabled: true,
      },
      select: {
        code: true,
      },
    });

    if (!availableLanguage) {
      throw new BadRequestException(
        'Language is not available or is disabled',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { language },
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
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail },
        ],
      },
    });
  }

  async validatePassword(user: any, password: string) {
    return bcrypt.compare(password, user.password);
  }

  async createUser(username: string, email: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
      },
    });
  }
}
