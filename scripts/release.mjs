import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateManifest(value) {
  if (!value || typeof value.version !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(value.version)) throw new Error('Invalid release version');
  const result = { version: value.version };
  for (const name of ['frontend','backend','notifications']) {
    const image = value[name];
    const pinned = typeof image === 'string' && (image.includes('@')
      ? /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(image)
      : /^[a-z0-9][a-z0-9./:_-]*:[a-z0-9_][a-z0-9_.-]{0,127}$/.test(image));
    if (!pinned || image.endsWith(':latest')) throw new Error(`Invalid pinned image: ${name}`);
    result[name] = image;
  }
  return result;
}
export function docker(args, options = {}) {
  const context = process.env.DOCKER_CONTEXT ? ['--context',process.env.DOCKER_CONTEXT] : [];
  const result = spawnSync('docker',[...context,...args], { encoding:'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker failed (${result.status}): ${result.stderr?.slice(-3000) ?? ''}`);
  return result.stdout;
}
export function deploymentConfig() {
  const project = process.env.RELEASE_PROJECT;
  const origin = process.env.RELEASE_ORIGIN;
  if (!project || !/^[a-z0-9][a-z0-9_-]+$/.test(project)) throw new Error('Set RELEASE_PROJECT explicitly');
  const url = new URL(origin);
  if (!['http:','https:'].includes(url.protocol) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw new Error('Invalid RELEASE_ORIGIN');
  return { project, origin:url.origin, args:['compose','--project-name',project,'-f','docker-compose.yml','-f','docker-compose.release.yml'] };
}
export function imageEnvironment(manifest) {
  return { ...process.env, FRONTEND_IMAGE:manifest.frontend, BACKEND_IMAGE:manifest.backend, NOTIFICATIONS_IMAGE:manifest.notifications };
}
export async function deploy(action, filename) {
  const config = deploymentConfig();
  const directory = resolve('.deploy',config.project); mkdirSync(directory,{ recursive:true });
  const statePath = resolve(directory,'state.json');
  const lockPath = resolve(directory,'lock');
  const lock = openSync(lockPath,'wx');
  try {
    const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath,'utf8')) : {};
    const identity = { origin:config.origin, port:process.env.APP_PORT ?? '8080', bind:process.env.APP_BIND_ADDRESS ?? '0.0.0.0', envFile:resolve('.env') };
    if (state.identity && JSON.stringify(state.identity) !== JSON.stringify(identity)) throw new Error('Deployment target differs from saved state');
    if (!['deploy','rollback'].includes(action)) throw new Error('Use deploy <manifest.json> or rollback');
    const candidate = validateManifest(action === 'rollback' ? state.previous : JSON.parse(readFileSync(filename,'utf8')));
    const timeout = Number(process.env.RELEASE_WAIT_SECONDS ?? 120);
    if (!Number.isInteger(timeout) || timeout < 10 || timeout > 600) throw new Error('Invalid wait timeout');
    const apply = async manifest => {
      const env = imageEnvironment(manifest);
      if (process.env.RELEASE_PULL !== 'never') docker([...config.args,'pull','db','redis','nginx','frontend','backend','notifications'],{ env });
      docker([...config.args,'up','-d','--no-build','--pull','never','--wait','--wait-timeout',String(timeout)],{ env });
      for (const path of ['/api/ready','/login']) {
        const response = await fetch(`${config.origin}${path}`,{ signal:AbortSignal.timeout(15000),redirect:'error' });
        if (!response.ok) throw new Error(`Smoke check failed: ${path} (${response.status})`);
        if (path === '/api/ready') {
          const ready = await response.json();
          if (!ready.database || !ready.redis) throw new Error('Dependencies not ready');
        } else await response.arrayBuffer();
      }
    };
    try { await apply(candidate); }
    catch (error) {
      if (state.current) {
        console.error('Release failed; restoring last healthy images.');
        // Rollback uses previously cached images, even when the registry is down.
        const previousPull = process.env.RELEASE_PULL; process.env.RELEASE_PULL = 'never';
        try { await apply(validateManifest(state.current)); console.error('Previous release recovered.'); }
        finally { if (previousPull === undefined) delete process.env.RELEASE_PULL; else process.env.RELEASE_PULL = previousPull; }
      }
      throw error;
    }
    const next = { identity, current:candidate, previous:state.current ?? null, updatedAt:new Date().toISOString() };
    writeFileSync(`${statePath}.tmp`,JSON.stringify(next,null,2)+'\n'); renameSync(`${statePath}.tmp`,statePath);
    console.log(JSON.stringify({ project:config.project, version:candidate.version, status:'healthy', action }));
    return next;
  } finally { closeSync(lock); unlinkSync(lockPath); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deploy(process.argv[2],process.argv[3]).catch(error => { console.error(error.message); process.exitCode=1; });
}
