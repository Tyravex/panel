import type { WebSocket } from 'ws';

export type AgentSession = {
    sessionId: string;
    nodeId: string;
    token: string;
    socket: WebSocket;
    ready: boolean;
    processing: boolean;
    lastHeartbeat: number;
    awaitingPong: boolean;
    helloTimer: NodeJS.Timeout;
    ownershipRefreshPending: boolean;
};