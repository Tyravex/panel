export const WS_PATH = '/agent/v1/ws';

export const MAX_MESSAGE_BYTES = 16 * 1024;
export const MAX_PENDING_AUTH = 64;

export const AUTH_TIMEOUT_MS = 10_000;
export const HELLO_TIMEOUT_MS = 10_000;
export const HEARTBEAT_TIMEOUT_MS = 90_000;
export const COMMAND_RESPONSE_TIMEOUT_MS = 120_000;
export const PING_INTERVAL_MS = 30_000;
export const OWNERSHIP_REFRESH_INTERVAL_MS = 30_000;
export const OWNERSHIP_BUILD_TIMEOUT_MS = 10_000;