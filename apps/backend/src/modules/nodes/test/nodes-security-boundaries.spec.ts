import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodesService } from '../nodes.service';

describe('NodesService security boundaries', () => {
    const create = jest.fn();
    const update = jest.fn();
    const findUnique = jest.fn();
    const generateToken = jest.fn();
    const hashToken = jest.fn();
    const verifyToken = jest.fn();
    let service: NodesService;

    beforeEach(() => {
        jest.resetAllMocks();
        generateToken.mockReturnValue('secret-token');
        hashToken.mockReturnValue('hashed-token');
        service = new NodesService(
            { node: { create, update, findUnique } } as unknown as PrismaService,
            { generateToken, hashToken, verifyToken } as unknown as NodeTokenService,
        );
    });

    it.each(['', '   ', 'x'.repeat(101)])('rejects invalid node name before generating a token', async (name) => {
        await expect(service.createNode(name)).rejects.toThrow(BadRequestException);
        expect(generateToken).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('trims names and persists only the hashed token', async () => {
        create.mockResolvedValue({ id: 'node-1', name: 'Node', status: 'OFFLINE' });
        await expect(service.createNode('  Node  ')).resolves.toEqual({
            id: 'node-1', name: 'Node', status: 'OFFLINE', token: 'secret-token',
        });
        expect(hashToken).toHaveBeenCalledWith('secret-token');
        expect(create).toHaveBeenCalledWith({
            data: { name: 'Node', tokenHash: 'hashed-token' },
            select: { id: true, name: true, status: true, createdAt: true },
        });
    });

    it('rejects blank node IDs before rotating credentials', async () => {
        await expect(service.rotateToken('  ')).rejects.toThrow(BadRequestException);
        expect(generateToken).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('does not mask unexpected database errors during rotation', async () => {
        const failure = new Error('Database unavailable');
        update.mockRejectedValue(failure);
        await expect(service.rotateToken('node-1')).rejects.toBe(failure);
    });

    it('maps a missing node during rotation to 404', async () => {
        update.mockRejectedValue({ code: 'P2025' });
        await expect(service.rotateToken('missing')).rejects.toThrow(NotFoundException);
    });

    it.each([
        ['', 'token'],
        ['node-1', ''],
        ['node-1', undefined],
    ])('rejects missing node credentials without database lookup', async (id, token) => {
        await expect(service.authenticateNode(id, token as string)).resolves.toBeNull();
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects unknown nodes without attempting token verification', async () => {
        findUnique.mockResolvedValue(null);
        await expect(service.authenticateNode('missing', 'token')).resolves.toBeNull();
        expect(verifyToken).not.toHaveBeenCalled();
    });

    it('never exposes tokenHash in successful node authentication', async () => {
        findUnique.mockResolvedValue({
            id: 'node-1', name: 'Node', status: 'ONLINE', tokenHash: 'stored-hash',
        });
        verifyToken.mockReturnValue(true);
        const result = await service.authenticateNode('node-1', 'secret-token');
        expect(verifyToken).toHaveBeenCalledWith('secret-token', 'stored-hash');
        expect(result).toEqual({ id: 'node-1', name: 'Node', status: 'ONLINE' });
        expect(result).not.toHaveProperty('tokenHash');
    });
});
