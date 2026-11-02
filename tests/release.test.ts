import { test } from 'node:test';
import assert from 'node:assert/strict';
// JavaScript module is shared with the dependency-free production CLI.
// @ts-expect-error CLI module intentionally has no declaration file
import { validateManifest } from '../scripts/release.mjs';
const valid = { version:'release-1',frontend:'ghcr.io/example/frontend:abc123',backend:'ghcr.io/example/backend:abc123',notifications:'ghcr.io/example/notifications:abc123' };
test('release manifest rejects unpinned, latest, malformed and shell-like image names', () => {
  for (const image of ['nginx','repo/image:latest','repo/image;echo-secret','--privileged','repo/image:tag\nsecret','repo/image@sha256:abc']) {
    assert.throws(() => validateManifest({ ...valid, backend:image }));
  }
  assert.throws(() => validateManifest({ ...valid,version:'../state' }));
  assert.throws(() => validateManifest(null));
});
test('release manifest supports registry ports and immutable digest references without passing extra fields', () => {
  const manifest = { ...valid, backend:`registry.example:5000/backend@sha256:${'a'.repeat(64)}`,secret:'not copied' };
  const result = validateManifest(manifest);
  assert.equal(result.backend,manifest.backend); assert.equal('secret' in result,false);
});
