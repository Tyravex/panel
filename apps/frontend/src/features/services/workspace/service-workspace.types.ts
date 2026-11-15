export { getServiceKind, type ServiceKind } from '../lib/serviceKind';

export type ServiceSection =
    | "overview"
    | "console"
    | "files"
    | "extensions"
    | "players"
    | "channels"
    | "permissions"
    | "environment"
    | "logs"
    | "modules"
    | "backups"
    | "schedules"
    | "settings";
