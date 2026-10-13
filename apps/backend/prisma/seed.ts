import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await prisma.permission.createMany({
  data: [
    { name: 'game:create' },
    { name: 'game:publish' },
    { name: 'user:read' },
  ],
});

const adminRole = await prisma.role.create({
  data: {
    name: 'admin',
    permissions: {
      connect: [{ name: 'game:create' }, { name: 'game:publish' }],
    },
  },
});
