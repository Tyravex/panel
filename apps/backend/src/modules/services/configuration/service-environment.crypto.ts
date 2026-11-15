import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

function encryptionKey(): Buffer {
  const raw = process.env.SERVICE_ENVIRONMENT_KEY;
  if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw new ServiceUnavailableException('Configure SERVICE_ENVIRONMENT_KEY with a dedicated 32-byte hexadecimal encryption key');
  return Buffer.from(raw, 'hex');
}

/** Bind ciphertext to the service to prevent cross-service substitution. */
export function encryptServiceEnvironment(serviceId: string, values: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`tyravex:service-environment:v1:${serviceId}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptServiceEnvironment(serviceId: string, envelope: string | null | undefined): Record<string, string> {
  if (!envelope) return {};
  try {
    const [version, iv, tag, ciphertext, extra] = envelope.split('.');
    if (version !== 'v1' || extra !== undefined || !iv || !tag || !ciphertext) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(`tyravex:service-environment:v1:${serviceId}`));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const values: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    if (typeof values !== 'object' || values === null || Array.isArray(values) || Object.values(values).some((value) => typeof value !== 'string')) throw new Error();
    return values as Record<string, string>;
  } catch {
    throw new ServiceUnavailableException('Service environment is unavailable; verify the encryption key');
  }
}
