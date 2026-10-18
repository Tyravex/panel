import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService transactional audit', () => {
  const tx = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new AdminUsersService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    prisma.user.findUnique.mockResolvedValue({ id: 12 });
    tx.user.create.mockResolvedValue({ id: 12, username: 'tester', email: 'tester@example.com' });
    tx.user.update.mockResolvedValue({ id: 12, username: 'renamed', email: 'renamed@example.com' });
    tx.adminAuditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('creates a user and USER_CREATED audit entry in the same transaction', async () => {
    await expect(service.create({
      username: 'tester', email: 'tester@example.com', password: 'long-secure-password',
    }, 7)).resolves.toMatchObject({ id: 12 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ username: 'tester', email: 'tester@example.com', password: expect.any(String) }),
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({ data: {
      actorId: 7, action: 'USER_CREATED', targetType: 'USER', targetId: '12',
      metadata: { username: 'tester' },
    } });
    const savedPassword = tx.user.create.mock.calls[0][0].data.password as string;
    expect(savedPassword).not.toBe('long-secure-password');
    expect(JSON.stringify(tx.adminAuditLog.create.mock.calls)).not.toContain('long-secure-password');
    expect(JSON.stringify(tx.adminAuditLog.create.mock.calls)).not.toContain(savedPassword);
  });

  it('updates a user and writes USER_UPDATED in the same transaction', async () => {
    await expect(service.update(12, {
      username: 'renamed', email: 'renamed@example.com',
    }, 7)).resolves.toMatchObject({ id: 12 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 12 },
      data: { username: 'renamed', email: 'renamed@example.com' },
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({ data: {
      actorId: 7, action: 'USER_UPDATED', targetType: 'USER', targetId: '12',
      metadata: { username: 'renamed' },
    } });
  });

  it('propagates audit failure during creation through the transaction', async () => {
    const auditError = new Error('Audit storage unavailable');
    tx.adminAuditLog.create.mockRejectedValueOnce(auditError);

    await expect(service.create({
      username: 'tester', email: 'tester@example.com', password: 'long-secure-password',
    }, 7)).rejects.toBe(auditError);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates audit failure during update through the transaction', async () => {
    const auditError = new Error('Audit storage unavailable');
    tx.adminAuditLog.create.mockRejectedValueOnce(auditError);

    await expect(service.update(12, {
      username: 'renamed', email: 'renamed@example.com',
    }, 7)).rejects.toBe(auditError);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
