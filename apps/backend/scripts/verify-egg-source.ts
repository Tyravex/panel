import { RemoteJsonService } from '../src/infrastructure/http/remote-json.service';
import { TYRAVEX_EGGS_INDEX, pinEggSource, eggDigest } from '../src/modules/eggs/catalog/egg-source';
import { adaptRepositoryEgg } from '../src/modules/eggs/catalog/egg-repository.adapter';
import { record } from '../src/modules/eggs/catalog/egg-catalog-options';

async function main() {
  const remote = new RemoteJsonService();
  const source = await pinEggSource(TYRAVEX_EGGS_INDEX, remote);
  const index = await remote.getJson(source.url);
  if (!record(index) || index.schemaVersion !== 1 || !Array.isArray(index.eggs) || index.eggs.length > 50) throw new Error('Invalid repository index');
  const entries = [];
  for (const entry of index.eggs) {
    if (!record(entry) || typeof entry.path !== 'string') throw new Error('Invalid repository entry');
    const url = new URL(entry.path, source.url);
    if (!url.href.startsWith(source.url.slice(0, source.url.lastIndexOf('/') + 1))) throw new Error('Entry escapes source');
    const raw = await remote.getJson(url.href);
    const manifest = adaptRepositoryEgg(raw);
    if (manifest.id !== entry.id || manifest.version !== entry.version) throw new Error('Index identity mismatch');
    entries.push({ id: manifest.id, version: manifest.version, profiles: manifest.catalog?.profiles.length ?? 0, runtimeVersions: manifest.catalog?.versions.length ?? 0, sha256: eggDigest(raw) });
  }
  console.log(JSON.stringify({ commit: source.commit, count: entries.length, entries }, null, 2));
}
main().catch(() => { console.error('Repository verification failed. No database or repository files were changed.'); process.exitCode = 1; });
