import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_RBAC_SETTINGS_ID } from './default-role.service';

type TransactionClient = Prisma.TransactionClient;

export async function createUserWithDefaultRole<T extends Prisma.UserSelect>(
  tx: TransactionClient,
  data: Prisma.UserCreateInput,
  select: T,
): Promise<Prisma.UserGetPayload<{ select: T }>> {
  // Serialize with default-role changes, permission edits and role deletion.
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(847201, 1)::text
  `;

  const settings = await tx.rbacSettings.findUnique({
    where: { id: DEFAULT_RBAC_SETTINGS_ID },
    select: {
      defaultRole: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const role = settings?.defaultRole;

  if (
    !role ||
    role.name.toLowerCase() === 'owner' ||
    role.permissions.length > 0
  ) {
    throw new ServiceUnavailableException(
      'A valid default user role is not configured',
    );
  }

  return tx.user.create({
    data: {
      ...data,
      roles: {
        create: {
          role: {
            connect: { id: role.id },
          },
        },
      },
    },
    select,
  }) as Promise<Prisma.UserGetPayload<{ select: T }>>;
}