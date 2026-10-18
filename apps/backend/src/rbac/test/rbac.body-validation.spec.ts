import { BadRequestException } from '@nestjs/common';
import { RbacService } from '../rbac.service';

describe('RbacService role body validation boundaries', () => {
    const prisma = { $transaction: jest.fn() };
    const service = new RbacService(prisma as never);

    beforeEach(() => jest.clearAllMocks());

    const invalidBodies: Array<[string, unknown]> = [
        ['missing body', undefined],
        ['empty body', {}],
        ['missing name', { permissionIds: [] }],
        ['non-string name', { name: 123, permissionIds: [] }],
        ['short name', { name: 'ab', permissionIds: [] }],
        ['invalid name characters', { name: 'bad@name', permissionIds: [] }],
        ['reserved Owner name', { name: 'Owner', permissionIds: [] }],
        ['reserved Owner name with whitespace', { name: ' owner ', permissionIds: [] }],
        ['missing permission IDs', { name: 'Support' }],
        ['non-array permission IDs', { name: 'Support', permissionIds: 'permission-id' }],
        ['non-string permission ID', { name: 'Support', permissionIds: [123] }],
        ['blank permission ID', { name: 'Support', permissionIds: ['  '] }],
        ['duplicate permission IDs', { name: 'Support', permissionIds: ['permission-id', 'permission-id'] }],
        ['too many permission IDs', { name: 'Support', permissionIds: Array.from({ length: 101 }, (_, i) => `p-${i}`) }],
    ];

    it.each(invalidBodies)('rejects %s on create before transaction', async (_label, body) => {
        await expect(service.createRole(body as never, 7)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(invalidBodies)('rejects %s on update before transaction', async (_label, body) => {
        await expect(service.updateRole('role-9', body as never, 7)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a blank role ID on update before transaction', async () => {
        await expect(service.updateRole(' ', { name: 'Support', permissionIds: [] }, 7))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
