export const SERVICE_PERMISSIONS = [
  'service:view',
  'service:console:view',
  'service:console:send',
  'service:power:start',
  'service:power:stop',
  'service:power:restart',
  'service:files:read',
  'service:files:write',
  'service:backups:create',
  'service:settings:update',
] as const;

export type ServicePermission = (typeof SERVICE_PERMISSIONS)[number];
