
import {
    Injectable,
    OnApplicationShutdown,
} from '@nestjs/common';
import { Server as HttpServer } from 'node:http';

import { NodesService } from '../nodes.service';
import { AgentWebSocketServer } from './agent-websocket.server';

@Injectable()
export class AgentWebSocketLifecycle
    implements OnApplicationShutdown {
    private transport: AgentWebSocketServer | null = null;

    constructor(
        private readonly nodesService: NodesService,
    ) { }

    attach(httpServer: HttpServer): void {
        if (this.transport) {
            throw new Error(
                'Agent WebSocket transport is already attached',
            );
        }

        this.transport = new AgentWebSocketServer(
            httpServer,
            this.nodesService,
        );
    }

    disconnectNode(nodeId: string): void {
        this.transport?.disconnectNode(nodeId);
    }

    onApplicationShutdown(): void {
        this.transport?.close();
        this.transport = null;
    }
}
