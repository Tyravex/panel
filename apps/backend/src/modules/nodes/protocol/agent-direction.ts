import {
    AgentEnvelope,
    AgentMessageType,
} from './agent-protocol';

import {
    isValidAgentMessage,
} from './agent-payload';

export const AGENT_TO_PANEL_TYPES = [
    'node.hello',
    'node.heartbeat',
    'command.accepted',
    'command.result',
    'protocol.error',
] as const satisfies readonly AgentMessageType[];

export const PANEL_TO_AGENT_TYPES = [
    'node.welcome',
    'node.heartbeat.ack',
    'ownership.snapshot',
    'command.execute',
    'protocol.error',
] as const satisfies readonly AgentMessageType[];

export type AgentToPanelMessageType =
    (typeof AGENT_TO_PANEL_TYPES)[number];

export type PanelToAgentMessageType =
    (typeof PANEL_TO_AGENT_TYPES)[number];

export type AgentToPanelMessage =
    AgentEnvelope & {
        type: AgentToPanelMessageType;
    };

export type PanelToAgentMessage =
    AgentEnvelope & {
        type: PanelToAgentMessageType;
    };

const AGENT_TO_PANEL_SET = new Set<string>(
    AGENT_TO_PANEL_TYPES,
);

const PANEL_TO_AGENT_SET = new Set<string>(
    PANEL_TO_AGENT_TYPES,
);

export function isAgentToPanelMessage(
    value: unknown,
): value is AgentToPanelMessage {
    return (
        isValidAgentMessage(value) &&
        AGENT_TO_PANEL_SET.has(value.type)
    );
}

export function isPanelToAgentMessage(
    value: unknown,
): value is PanelToAgentMessage {
    return (
        isValidAgentMessage(value) &&
        PANEL_TO_AGENT_SET.has(value.type)
    );
}
