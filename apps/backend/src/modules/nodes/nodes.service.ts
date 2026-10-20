import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from './node-token.service';

@Injectable()
export class NodesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tokenService: NodeTokenService,
    ) { }

    // List nodes without exposing authentication credentials.
    async findAll() {
        return this.prisma.node.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                lastSeenAt: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Return public node metadata without exposing the token hash.
    async findById(nodeId: string) {
        return this.prisma.node.findUnique({
            where: { id: nodeId },
            select: {
                id: true,
                name: true,
                status: true,
                lastSeenAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    // Provision a new node and reveal its token only once.
    async createNode(name: string) {
        const normalizedName = name?.trim();

        if (
            !normalizedName ||
            normalizedName.length > 100
        ) {
            throw new BadRequestException(
                'Node name must contain between 1 and 100 characters',
            );
        }

        const token = this.tokenService.generateToken();
        const tokenHash = this.tokenService.hashToken(token);

        const node = await this.prisma.node.create({
            data: {
                name: normalizedName,
                tokenHash,
            },
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
            },
        });

        return {
            ...node,
            token,
        };
    }

    // Replace the existing token, immediately invalidating the old one.
    async rotateToken(nodeId: string) {
        if (!nodeId?.trim()) {
            throw new BadRequestException(
                'Node ID is required',
            );
        }

        const token = this.tokenService.generateToken();
        const tokenHash = this.tokenService.hashToken(token);

        try {
            const node = await this.prisma.node.update({
                where: { id: nodeId },
                data: {
                    tokenHash,
                    status: 'OFFLINE',
                    lastSeenAt: null,
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            return {
                ...node,
                token,
            };
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException(
                    `Node ${nodeId} not found`,
                );
            }

            throw error;
        }
    }

    // Verify credentials without returning the stored token hash.
    async authenticateNode(nodeId: string, token: string) {
        if (
            typeof nodeId !== 'string' ||
            !nodeId ||
            typeof token !== 'string' ||
            !token
        ) {
            return null;
        }

        const node = await this.prisma.node.findUnique({
            where: { id: nodeId },
            select: {
                id: true,
                name: true,
                status: true,
                tokenHash: true,
            },
        });

        if (
            !node ||
            !this.tokenService.verifyToken(
                token,
                node.tokenHash,
            )
        ) {
            return null;
        }

        return {
            id: node.id,
            name: node.name,
            status: node.status,
        };
    }
}