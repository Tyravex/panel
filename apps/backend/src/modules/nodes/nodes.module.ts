import { Module } from '@nestjs/common';

import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeTokenService } from './node-token.service';

@Module({
    controllers: [NodesController],
    providers: [
        NodesService,
        NodeTokenService,
    ],
    exports: [
        NodesService,
        NodeTokenService,
    ],
})
export class NodesModule {}