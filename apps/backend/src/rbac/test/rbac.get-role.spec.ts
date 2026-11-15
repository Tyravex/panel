import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RbacService } from '../rbac.service';
import { RbacController } from '../rbac.controller';
import { PrismaService } from '@/prisma/prisma.service';

describe('Single role lookup', () => {
    const findUnique = jest.fn();
    const service = new RbacService({ role: { findUnique } } as unknown as PrismaService);
    beforeEach(() => jest.resetAllMocks());

    it('returns a role and its assigned permissions', async () => {
        const role = { id: 'role-1', name: 'Support', permissions: [{ id: 'p1', name: 'user:read' }], _count: { users: 2 } };
        findUnique.mockResolvedValue(role);
        await expect(service.getRole('role-1')).resolves.toEqual(role);
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'role-1' } }));
    });

    it('returns not found for an unknown ID', async () => {
        findUnique.mockResolvedValue(null);
        await expect(service.getRole('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty ID without querying storage', async () => {
        await expect(service.getRole(' ')).rejects.toBeInstanceOf(BadRequestException);
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('requires role:read on the endpoint, overriding role:manage on the controller', () => {
        expect(Reflect.getMetadata('permissions', RbacController.prototype.getRole)).toEqual(['role:read']);
    });
});
