import {
    Body,
    Controller,
    Get,
    Header,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { CreateNodeDto } from './dto/create-node.dto';
import { NodesService } from './nodes.service';

@Controller('nodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('node:manage')
export class NodesController {
    constructor(
        private readonly nodesService: NodesService,
    ) { }

    // Return all nodes without authentication credentials.
    @Get()
    findAll() {
        return this.nodesService.findAll();
    }

    // Provision a node and return its token only once.
    @Post()
    @Header('Cache-Control', 'no-store')
    create(@Body() body: CreateNodeDto) {
        return this.nodesService.createNode(body.name);
    }

    // Return public node metadata without credentials.
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.nodesService.findById(id);
    }

    // Invalidate the previous token and issue a replacement.
    @Post(':id/rotate-token')
    @Header('Cache-Control', 'no-store')
    rotateToken(@Param('id') id: string) {
        return this.nodesService.rotateToken(id);
    }
}