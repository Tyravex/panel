import { validateEggManifest } from '../egg-manifest.validator';

const manifest = {
  format: 'tyravex-egg', formatVersion: 1, id: 'test-game', name: 'Test', version: '1.0.0', category: 'server',
  runtime: { image: 'example/game:1', startup: './start' },
  resources: { memoryMb: 1024, cpuPercent: 100, diskMb: 2048 },
};
describe('Egg installation protocol limits', () => {
  it('rejects CPU that the node protocol cannot accept', () => {
    expect(() => validateEggManifest({ ...manifest, resources: { ...manifest.resources, cpuPercent: 101 } })).toThrow();
  });
  it('accepts 64 variable declarations but rejects 65', () => {
    const variables = Array.from({ length: 65 }, (_, index) => ({ name: `VAR_${index}`, required: true, secret: false }));
    expect(() => validateEggManifest({ ...manifest, variables: variables.slice(0, 64) })).not.toThrow();
    expect(() => validateEggManifest({ ...manifest, variables })).toThrow();
  });
});
