import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  const update = jest.fn();

  const prisma = {
    user: { update },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as unknown as PrismaService);
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
});