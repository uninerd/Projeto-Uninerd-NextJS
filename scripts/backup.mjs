import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { docker, deploymentConfig, imageEnvironment, validateManifest } from './release.mjs';

export function backup() {
  const config = deploymentConfig();
  const stateDirectory = resolve('.deploy',config.project);
  const state = JSON.parse(readFileSync(resolve(stateDirectory,'state.json'),'utf8'));
  if (state.identity.origin !== config.origin) throw new Error('Backup target does not match saved deployment');
  const manifest = validateManifest(state.current);
  const lockPath = resolve(stateDirectory,'lock'); const lock = openSync(lockPath,'wx');
  const id = `${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}`;
  const directory = resolve('backups',config.project,id);
  const temporary = `/tmp/uninerd-backup-${randomUUID()}.sqlite`;
  const env = imageEnvironment(manifest);
  const execWorker = code => docker([...config.args,'exec','-T','notifications','node','--input-type=module','-e',code],{ env });
  try {
    mkdirSync(directory,{ recursive:true,mode:0o700 });
    const dump = docker([...config.args,'exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -u"$MYSQL_USER" --single-transaction --no-tablespaces --skip-lock-tables "$MYSQL_DATABASE"'],{ env,maxBuffer:128*1024*1024 });
    writeFileSync(resolve(directory,'mysql.sql'),dump,{ mode:0o600 });
    execWorker(`import { DatabaseSync, backup } from 'node:sqlite'; const db = new DatabaseSync('/data/notifications.sqlite',{readOnly:true}); await backup(db,${JSON.stringify(temporary)}); db.close();`);
    docker([...config.args,'cp',`notifications:${temporary}`,resolve(directory,'notifications.sqlite')],{ env });
    const hashes = Object.fromEntries(['mysql.sql','notifications.sqlite'].map(name => [name,createHash('sha256').update(readFileSync(resolve(directory,name))).digest('hex')]));
    writeFileSync(resolve(directory,'metadata.json'),JSON.stringify({ timestamp:new Date().toISOString(),project:config.project,manifest,hashes },null,2)+'\n');
    return directory;
  } finally {
    try { execWorker(`import { unlinkSync } from 'node:fs'; unlinkSync(${JSON.stringify(temporary)});`); }
    catch { /* A failed snapshot can leave only a uniquely named /tmp file. */ }
    closeSync(lock); unlinkSync(lockPath);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(backup()); } catch (error) { console.error(error.message); process.exitCode=1; }
}
