import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('UsersService', () => {
  const update = jest.fn();
  const findFirst = jest.fn();

  const prisma = {
    user: { update },
    language: { findFirst },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.resetAllMocks();

    findFirst.mockResolvedValue({ code: 'pl' });

    service = new UsersService(
      prisma as unknown as PrismaService,
    );
  });

  it('excludes password from updated user preferences', async () => {
    update.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.invalid',
      language: 'pl',
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.updatePreferences(1, {
      language: 'pl',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        code: 'pl',
        isEnabled: true,
      },
      select: {
        code: true,
      },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { language: 'pl' },
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

    expect(result).not.toHaveProperty('password');
  });

  it('rejects a language that is not enabled', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.updatePreferences(1, { language: 'pl' }),
    ).rejects.toThrow(BadRequestException);

    expect(update).not.toHaveBeenCalled();
  });

  describe('updateProfile', () => {
    it('updates Polish first and last names for the authenticated user', async () => {
      update.mockResolvedValue({
        id: 12,
        username: 'testuser',
        email: 'test@example.invalid',
        firstName: 'Łukasz',
        lastName: 'Żółć-Nowak',
      });

      const result = await service.updateProfile(12, {
        firstName: 'Łukasz',
        lastName: 'Żółć-Nowak',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: {
          firstName: 'Łukasz',
          lastName: 'Żółć-Nowak',
        },
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

      expect(result).not.toHaveProperty('password');
    });

    it('allows clearing a name with null or an empty string', async () => {
      update.mockResolvedValue({
        id: 12,
        firstName: null,
        lastName: null,
      });

      await service.updateProfile(12, {
        firstName: null,
        lastName: '',
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12 },
          data: {
            firstName: null,
            lastName: null,
          },
        }),
      );
    });

    it('updates only the supplied field', async () => {
      update.mockResolvedValue({ id: 12, firstName: 'Anna' });

      await service.updateProfile(12, { firstName: 'Anna' });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: 'Anna' },
        }),
      );
    });

    it.each([
      ['missing body', undefined],
      ['null body', null],
      ['array body', []],
      ['empty object', {}],
      ['unknown property', { roles: ['Owner'] }],
      ['privilege escalation', { firstName: 'Anna', isActive: true }],
      ['another user ID', { firstName: 'Anna', userId: 999 }],
      ['numeric name', { firstName: 123 }],
      ['whitespace-only name', { firstName: '   ' }],
      ['leading whitespace', { firstName: ' Anna' }],
      ['trailing whitespace', { lastName: 'Nowak ' }],
      ['name longer than 80 characters', { firstName: 'A'.repeat(81) }],
      ['invalid characters', { firstName: '<script>' }],
    ])('rejects %s without writing to the database', async (_label, body) => {
      await expect(
        service.updateProfile(12, body),
      ).rejects.toThrow(BadRequestException);

      expect(update).not.toHaveBeenCalled();
    });
  });
});
