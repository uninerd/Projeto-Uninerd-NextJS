import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { docker, deploy, deploymentConfig, imageEnvironment } from './release.mjs';
import { backup } from './backup.mjs';

// Fixed isolated target: never points this drill at the development application.
Object.assign(process.env, {
  RELEASE_PROJECT:'uninerd-release-drill', RELEASE_ORIGIN:'http://127.0.0.1:8180',
  APP_ORIGIN:'http://127.0.0.1:8180', APP_PORT:'8180', APP_BIND_ADDRESS:'127.0.0.1',
  RELEASE_PULL:'never', RELEASE_WAIT_SECONDS:'30',
});
const directory = '.deploy/uninerd-release-drill'; mkdirSync(directory,{ recursive:true });
const source = {
  frontend:process.env.DRILL_FRONTEND_IMAGE ?? 'projetouninerdnextjs-frontend:latest',
  backend:process.env.DRILL_BACKEND_IMAGE ?? 'projetouninerdnextjs-backend:latest',
  notifications:process.env.DRILL_NOTIFICATIONS_IMAGE ?? 'projetouninerdnextjs-notifications:latest',
};
const a = { version:'drill-a' }; const b = { version:'drill-b' };
for (const service of ['frontend','backend','notifications']) {
  docker(['image','inspect',source[service]],{ stdio:['ignore','ignore','pipe'] });
  for (const manifest of [a,b]) {
    manifest[service] = `uninerd-drill/${service}:${manifest.version}`;
    docker(['image','tag',source[service],manifest[service]]);
  }
}
const bad = { ...b, version:'drill-broken', backend:'uninerd-drill/backend:broken' };
docker(['image','tag','redis:7.4-alpine',bad.backend]);
for (const manifest of [a,b,bad]) writeFileSync(`${directory}/${manifest.version}.json`,JSON.stringify(manifest,null,2));
const config = deploymentConfig();
const env = imageEnvironment(a);
const report = { timestamp:new Date().toISOString(), project:config.project, origin:config.origin,
  scope:'Isolated local deployment; A/B are two tags of the same application artifacts; broken backend is a Redis image, not a code release', steps:[] };
async function run() {
  const startedAt = Date.now();
  try {
    // Start with a known baseline; no volumes are removed, even between runs.
    await deploy('deploy',`${directory}/drill-a.json`); report.steps.push('A deployed and healthy');
    await deploy('deploy',`${directory}/drill-b.json`); report.steps.push('B deployed and healthy');
    await deploy('rollback');
    assert.equal(JSON.parse(readFileSync(`${directory}/state.json`,'utf8')).current.version,'drill-a');
    report.steps.push('Explicit rollback B -> A healthy');
    await assert.rejects(deploy('deploy',`${directory}/drill-broken.json`));
    assert.equal(JSON.parse(readFileSync(`${directory}/state.json`,'utf8')).current.version,'drill-a');
    assert.equal((await fetch(`${config.origin}/api/ready`)).status,200);
    report.steps.push('Unhealthy backend rejected; automatic recovery of A healthy');
    // Back up and restore only the isolated drill database. Do not dump credentials to logs.
    const exec = (...args) => docker([...config.args,'exec','-T','db',...args],{ env });
    const sql = query => exec('sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -e "$1"','sh',query).trim();
    sql('CREATE TABLE IF NOT EXISTS release_drill (id INT PRIMARY KEY, value VARCHAR(40)); INSERT INTO release_drill VALUES (1,"before-backup") ON DUPLICATE KEY UPDATE value="before-backup";');
    docker([...config.args,'exec','-T','notifications','node','--input-type=module','-e',"import { DatabaseSync } from 'node:sqlite'; import { mkdirSync } from 'node:fs'; mkdirSync('/tmp/uninerd-release-restore',{recursive:true}); const db = new DatabaseSync('/data/notifications.sqlite'); db.prepare('INSERT OR REPLACE INTO notifications VALUES (?,?,?,?,?)').run('release-drill-backup',42,42,'before-backup','2026-10-21T00:00:00Z'); db.close();"],{ env });
    const backupDirectory = backup();
    const dump = readFileSync(`${backupDirectory}/mysql.sql`,'utf8');
    assert.ok(dump.includes('release_drill'));
    sql('UPDATE release_drill SET value="changed-after-backup" WHERE id=1');
    docker([...config.args,'exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"'],{ env,input:dump });
    assert.equal(sql('SELECT value FROM release_drill WHERE id=1'),'before-backup');
    report.steps.push('Isolated MySQL logical backup restored and sentinel value verified');
    docker([...config.args,'cp',`${backupDirectory}/notifications.sqlite`,'notifications:/tmp/uninerd-release-restore/snapshot.sqlite'],{ env });
    const integrity = docker([...config.args,'exec','-T','notifications','node','--input-type=module','-e',"import { DatabaseSync } from 'node:sqlite'; import { unlinkSync } from 'node:fs'; const db = new DatabaseSync('/tmp/uninerd-release-restore/snapshot.sqlite',{readOnly:true}); console.log(JSON.stringify({integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,message:db.prepare('SELECT message FROM notifications WHERE eventId=?').get('release-drill-backup').message})); db.close(); unlinkSync('/tmp/uninerd-release-restore/snapshot.sqlite');"],{ env });
    assert.deepEqual(JSON.parse(integrity.trim()),{ integrity:'ok',message:'before-backup' });
    report.steps.push('SQLite backup reopened on separate file with integrity_check=ok and sentinel notification verified');
    report.passed = true;
    report.durationSeconds = Math.round((Date.now()-startedAt)/1000);
    mkdirSync('docs/evidencias',{ recursive:true });
    writeFileSync('docs/evidencias/entrega-local.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally {
    docker([...config.args,'down'],{ env }); // Preserves drill volumes; never down -v.
  }
}
run().catch(error => { console.error(error.message); process.exitCode=1; });
