import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RbacService } from '../rbac.service';

describe('RbacService role management', () => {
    const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        role: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        permission: { findMany: jest.fn() },
        userRole: { count: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const service = new RbacService(prisma as never);

    beforeEach(() => jest.clearAllMocks());

    it('prevents editing Owner', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Owner' });
        await expect(service.updateRole('owner-id', { name: 'Support', permissionIds: [] })).rejects.toBeInstanceOf(BadRequestException);
        expect(tx.role.update).not.toHaveBeenCalled();
    });

    it('rejects unknown permissions during update', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Support' });
        tx.permission.findMany.mockResolvedValue([]);
        await expect(service.updateRole('id', { name: 'Support', permissionIds: ['missing'] })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a role and replaces its permissions', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Support' });
        tx.permission.findMany.mockResolvedValue([{ id: 'p1' }]);
        tx.role.update.mockResolvedValue({ id: 'id', name: 'Support' });
        await service.updateRole('id', { name: 'Support', permissionIds: ['p1'] });
        expect(tx.role.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Support', permissions: { set: [{ id: 'p1' }] } } }));
    });

    it('prevents deleting Owner', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Owner' });
        await expect(service.deleteRole('id')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('prevents deleting assigned roles', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Support' });
        tx.userRole.count.mockResolvedValue(1);
        await expect(service.deleteRole('id')).rejects.toBeInstanceOf(ConflictException);
        expect(tx.role.delete).not.toHaveBeenCalled();
    });

    it('deletes unassigned custom roles', async () => {
        tx.role.findUnique.mockResolvedValue({ name: 'Support' });
        tx.userRole.count.mockResolvedValue(0);
        await service.deleteRole('id');
        expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: 'id' } });
    });

    it('returns 404 for missing roles', async () => {
        tx.role.findUnique.mockResolvedValue(null);
        await expect(service.deleteRole('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
});
