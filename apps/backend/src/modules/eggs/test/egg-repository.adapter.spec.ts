import { adaptRepositoryEgg } from '../catalog/egg-repository.adapter';
import { resolveEggSelection, buildInstallCatalog } from '../catalog/egg-catalog-options';
import { normalizeEggRepositoryUrl, eggDigest, TYRAVEX_EGGS_INDEX, pinEggSource } from '../catalog/egg-source';
import { RemoteJsonService } from '@/infrastructure/http/remote-json.service';
import discord from './fixtures/catalog-v1/discord-nodejs.json';
import python from './fixtures/catalog-v1/universal-python.json';

describe('Repository v1 adapter and service selection', () => {
  it('preserves Discord profiles, images, installer and secret declarations', () => {
    const manifest = adaptRepositoryEgg(discord);
    expect(manifest.id).toBe('tyravex.discord.nodejs');
    expect(manifest.category).toBe('discord_bot');
    expect(manifest.catalog?.install).toEqual({ mode: 'nodejs', packageManager: 'npm' });
    expect(manifest.variables).toEqual([{ name: 'DISCORD_TOKEN', required: true, secret: true }]);
    expect(resolveEggSelection(manifest, { profileId: 'dbm', runtimeVersion: '24' })).toEqual({ image: 'node:24-bookworm-slim', startup: 'node bot.js', profileId: 'dbm', runtimeVersion: '24' });
    expect(buildInstallCatalog(manifest, { profileId: 'dbm', runtimeVersion: '22' })).toEqual({ workingDirectory: '/app', install: { mode: 'nodejs', packageManager: 'npm' }, startup: { mode: 'node-file', entrypoint: 'bot.js' }, profileId: 'dbm', runtimeVersion: '22' });
  });
  it('maps Python applications and resolves defaults', () => {
    const manifest = adaptRepositoryEgg(python);
    expect(manifest.category).toBe('other');
    expect(resolveEggSelection(manifest)).toMatchObject({ startup: 'python main.py', runtimeVersion: '3.12', image: 'python:3.12-slim-bookworm' });
  });
  it('rejects unknown fields rather than discarding them', () => {
    expect(() => adaptRepositoryEgg({ ...discord, preInstallShell: 'curl example.com | sh' })).toThrow();
  });
  it('rejects traversal, shell metacharacters, mismatched installers, duplicate profiles and unknown runtime selections', () => {
    for (const entrypoint of ['../bot.js', '/bot.js', 'bot.js;whoami', '$(whoami).js']) {
      expect(() => adaptRepositoryEgg({ ...discord, startup: { mode: 'node-file', entrypoint } })).toThrow();
    }
    expect(() => adaptRepositoryEgg({ ...discord, install: { mode: 'python', packageManager: 'pip' } })).toThrow();
    expect(() => adaptRepositoryEgg({ ...discord, profiles: [discord.profiles[0], discord.profiles[0]] })).toThrow();
    expect(() => resolveEggSelection(adaptRepositoryEgg(discord), { runtimeVersion: '999' })).toThrow();
  });
  it('normalizes GitHub source and rejects credentials and fragments', () => {
    expect(normalizeEggRepositoryUrl('https://github.com/Tyravex/tyravex-eggs')).toBe(TYRAVEX_EGGS_INDEX);
    expect(() => normalizeEggRepositoryUrl('https://user:secret@github.com/Tyravex/tyravex-eggs')).toThrow();
    expect(() => normalizeEggRepositoryUrl('https://github.com/Tyravex/tyravex-eggs#main')).toThrow();
  });
  it('pins a GitHub branch to a validated commit before resolving manifest paths', async () => {
    const remote = { getJson: jest.fn().mockResolvedValue({ sha: 'a'.repeat(40) }) };
    expect(await pinEggSource(TYRAVEX_EGGS_INDEX, remote as unknown as RemoteJsonService)).toEqual({ url: TYRAVEX_EGGS_INDEX.replace('/main/', `/${'a'.repeat(40)}/`), commit: 'a'.repeat(40) });
  });
  it('hashes canonical JSON independently of property order', () => {
    expect(eggDigest({ a: 1, b: { x: 1, z: 2 } })).toBe(eggDigest({ b: { z: 2, x: 1 }, a: 1 }));
  });
});
