import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

export interface AgentEnvironmentBinding {
  nodeId: string; serviceId: string; jobId: string; commandId: string; sessionId: string; expiresAt: string;
}

/** Only a short-lived authenticated Agent session can open this response. */
export function sealAgentEnvironment(token: string, binding: AgentEnvironmentBinding, values: Record<string, string>) {
  const key = createHmac('sha256', token).update(`tyravex:agent-environment:v1:${binding.sessionId}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const aad = [binding.nodeId, binding.serviceId, binding.jobId, binding.commandId, binding.sessionId, binding.expiresAt].join('\n');
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  return { formatVersion: 1, ...binding, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
