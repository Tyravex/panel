import {
    Injectable,
    OnApplicationShutdown,
} from '@nestjs/common';
import { Server as HttpServer } from 'node:http';

import { NodesService } from '../nodes.service';
import { AgentCommandPayload } from '../protocol/agent-protocol';
import { AgentCommandsService } from './agent-commands.service';
import { AgentWebSocketServer } from './agent-websocket.server';

@Injectable()
export class AgentWebSocketLifecycle
    implements OnApplicationShutdown {
    private transport: AgentWebSocketServer | null = null;

    constructor(
        private readonly nodesService: NodesService,
        private readonly agentCommandsService: AgentCommandsService,
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
            this.agentCommandsService,
        );
    }

    /**
     * Legacy synchronous transport API.
     *
     * With durable tracking enabled, AgentWebSocketServer
     * rejects this path to prevent untracked execution.
     *
     * Existing callers must migrate to sendDurableCommand()
     * before dispatching Agent operations.
     */
    sendCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): boolean {
        return this.transport?.sendCommand(nodeId, command) ?? false;
    }

    /**
     * Sends a previously prepared durable Agent command.
     *
     * The commandId must match AgentCommand.id.
     * A database claim is required before WebSocket send.
     *
     * The return value indicates a send attempt, not
     * successful Agent execution.
     */
    async sendDurableCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): Promise<boolean> {
        if (!this.transport) {
            return false;
        }

        return this.transport.sendDurableCommand(
            nodeId,
            command,
        );
    }

    isNodeConnected(nodeId: string): boolean {
        return this.transport?.isNodeConnected(nodeId) ?? false;
    }

    disconnectNode(nodeId: string): void {
        this.transport?.disconnectNode(nodeId);
    }

    onApplicationShutdown(): void {
        this.transport?.close();
        this.transport = null;
    }
}
