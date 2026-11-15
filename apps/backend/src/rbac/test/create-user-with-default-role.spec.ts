import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createUserWithDefaultRole } from '../create-user-with-default-role';

describe('createUserWithDefaultRole', () => {
  const input = {
    username: 'new-user',
    email: 'new@example.com',
    password: 'hashed-password',
  };

  const select = {
    id: true,
    username: true,
    roles: {
      select: {
        role: {
          select: { id: true, name: true },
        },
      },
    },
  } as const;

  const validRole = {
    id: 'role-user',
    name: 'User',
    permissions: [],
  };

  let tx: {
    $queryRaw: jest.Mock;
    rbacSettings: { findUnique: jest.Mock };
    user: { create: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      rbacSettings: {
        findUnique: jest.fn().mockResolvedValue({
          defaultRole: validRole,
        }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 123,
          username: 'new-user',
          roles: [
            {
              role: {
                id: 'role-user',
                name: 'User',
              },
            },
          ],
        }),
      },
    };
  });

  const create = () =>
    createUserWithDefaultRole(
      tx as unknown as Prisma.TransactionClient,
      input,
      select,
    );

  it('creates a user with the configured default role', async () => {
    await expect(create()).resolves.toMatchObject({
      id: 123,
      username: 'new-user',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        ...input,
        roles: {
          create: {
            role: {
              connect: { id: 'role-user' },
            },
          },
        },
      },
      select,
    });
  });

  it('rejects missing RBAC settings without creating an account', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue(null);

    await expect(create()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects missing default role without creating an account', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRole: null,
    });

    await expect(create()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects Owner as the default role', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRole: {
        id: 'owner',
        name: 'Owner',
        permissions: [],
      },
    });

    await expect(create()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects a role with any global permission', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRole: {
        ...validRole,
        permissions: [{ id: 'permission-1' }],
      },
    });

    await expect(create()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('propagates database errors without retrying account creation', async () => {
    const error = new Error('Database write failed');
    tx.user.create.mockRejectedValue(error);

    await expect(create()).rejects.toBe(error);

    expect(tx.user.create).toHaveBeenCalledTimes(1);
  });
});