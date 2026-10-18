import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodesService } from '../nodes.service';

describe('NodesService', () => {
    const nodeId = 'node-test';

    let service: NodesService;
    let tokenService: NodeTokenService;

    const prisma = {
        node: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        tokenService = new NodeTokenService();

        service = new NodesService(
            prisma as unknown as PrismaService,
            tokenService,
        );
    });

    it('stores only the token hash when creating a node', async () => {
        prisma.node.create.mockImplementation(async ({ data }) => ({
            id: nodeId,
            name: data.name,
            status: 'OFFLINE',
        }));

        const result = await service.createNode('Test Node');

        const data = prisma.node.create.mock.calls[0][0].data;

        expect(result.token).toMatch(/^[a-f0-9]{64}$/);
        expect(data.tokenHash).not.toBe(result.token);
        expect(
            tokenService.verifyToken(result.token, data.tokenHash),
        ).toBe(true);
    });

    it('selects node metadata without the token hash', async () => {
        prisma.node.findUnique.mockResolvedValue({
            id: nodeId,
            name: 'Test Node',
            status: 'OFFLINE',
        });

        const result = await service.findById(nodeId);

        const query = prisma.node.findUnique.mock.calls[0][0];

        expect(query.select.tokenHash).toBeUndefined();
        expect(result).not.toHaveProperty('tokenHash');
    });

    it('replaces the token hash and resets node status', async () => {
        const oldToken = tokenService.generateToken();
        const oldHash = tokenService.hashToken(oldToken);

        let storedHash = oldHash;

        prisma.node.update.mockImplementation(async ({ data }) => {
            storedHash = data.tokenHash;

            return {
                id: nodeId,
                name: 'Test Node',
            };
        });

        const result = await service.rotateToken(nodeId);

        expect(storedHash).not.toBe(oldHash);
        expect(tokenService.verifyToken(oldToken, storedHash)).toBe(false);
        expect(tokenService.verifyToken(result.token, storedHash)).toBe(true);

        expect(prisma.node.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'OFFLINE',
                    lastSeenAt: null,
                }),
            }),
        );
    });

    it('rejects an invalid node token', async () => {
        const validToken = tokenService.generateToken();

        prisma.node.findUnique.mockResolvedValue({
            id: nodeId,
            name: 'Test Node',
            status: 'OFFLINE',
            tokenHash: tokenService.hashToken(validToken),
        });

        await expect(
            service.authenticateNode(nodeId, 'invalid-token'),
        ).resolves.toBeNull();
    });

    it('does not expose the token hash after authentication', async () => {
        const token = tokenService.generateToken();

        prisma.node.findUnique.mockResolvedValue({
            id: nodeId,
            name: 'Test Node',
            status: 'OFFLINE',
            tokenHash: tokenService.hashToken(token),
        });

        const result = await service.authenticateNode(nodeId, token);

        expect(result).toEqual({
            id: nodeId,
            name: 'Test Node',
            status: 'OFFLINE',
        });

        expect(result).not.toHaveProperty('tokenHash');
    });

    it('returns 404 when rotating a nonexistent node', async () => {
        prisma.node.update.mockRejectedValue({
            code: 'P2025',
        });

        await expect(
            service.rotateToken('missing-node'),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
