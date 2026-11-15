import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RemoteJsonService } from '@/infrastructure/http/remote-json.service';
import { isSafeCommunityHttpsUrl } from '@/infrastructure/http/public-url';
import { record } from './egg-catalog-options';

export const TYRAVEX_EGGS_INDEX = 'https://raw.githubusercontent.com/Tyravex/tyravex-eggs/main/registry.json';

export function normalizeEggRepositoryUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new BadRequestException('Invalid repository URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) throw new BadRequestException('Use HTTPS without credentials, query, fragment, or custom port');
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 2) url = new URL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1].replace(/\.git$/, '')}/main/registry.json`);
    else if (parts.length >= 5 && parts[2] === 'blob') url = new URL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`);
    else throw new BadRequestException('Use a repository URL or a direct registry.json URL');
  }
  if (!isSafeCommunityHttpsUrl(url.href)) throw new BadRequestException('Use a public HTTPS repository URL');
  return url.href;
}

export async function pinEggSource(input: string, remote: RemoteJsonService) {
  const url = new URL(normalizeEggRepositoryUrl(input));
  let commit: string | null = null;
  if (url.hostname === 'raw.githubusercontent.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 4) throw new BadRequestException('Invalid raw GitHub source');
    if (/^[a-f0-9]{40}$/.test(parts[2])) commit = parts[2];
    else {
      const response = await remote.getJson(`https://api.github.com/repos/${parts[0]}/${parts[1]}/commits/${encodeURIComponent(parts[2])}`);
      if (!record(response) || typeof response.sha !== 'string' || !/^[a-f0-9]{40}$/.test(response.sha)) throw new BadRequestException('Cannot resolve repository commit');
      commit = response.sha;
    }
    parts[2] = commit;
    url.pathname = `/${parts.join('/')}`;
  }
  return { url: url.href, commit };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export function eggDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
