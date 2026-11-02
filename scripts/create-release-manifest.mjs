import { mkdirSync, writeFileSync } from 'node:fs';
import { validateManifest } from './release.mjs';
const manifest = { version:process.env.GITHUB_SHA };
if (!/^[a-f0-9]{40}$/.test(manifest.version ?? '')) throw new Error('GITHUB_SHA must be a full commit SHA');
if (!/^ghcr\.io\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(process.env.IMAGE_PREFIX ?? '')) throw new Error('Invalid GHCR image prefix');
for (const service of ['frontend','backend','notifications']) {
  const digest = process.env[`${service.toUpperCase()}_DIGEST`];
  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? '')) throw new Error(`Missing image digest: ${service}`);
  manifest[service] = `${process.env.IMAGE_PREFIX}-${service}@${digest}`;
}
validateManifest(manifest);
mkdirSync('.deploy',{ recursive:true });
writeFileSync('.deploy/release.json',JSON.stringify(manifest,null,2)+'\n');
