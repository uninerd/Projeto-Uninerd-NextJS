import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createRecovery } from '../src/recovery.mjs';
import { createStore } from '../src/store.mjs';

test('outbox recovery retries failed acknowledgements without duplicate inbox entries', { timeout: 10000 }, async () => {
  const store=createStore(':memory:');
  const event={ eventId:'64771bc5-53f8-4d24-87c9-8acd9bf97752',event:'appointment.completed',
    appointmentId:7,patientId:2,doctorId:3,date:'2027-01-20T10:00:00',timestamp:'2026-11-12T12:00:00.000Z' };
  let acknowledgements=0, acknowledged=false, saved=0;
  const server=http.createServer(async (request,response)=>{
    assert.equal(request.headers['x-internal-key'],'synthetic-recovery-key');
    response.setHeader('content-type','application/json');
    if(request.method==='GET') return response.end(JSON.stringify({data:acknowledged?[]:[event]}));
    let body=''; for await(const chunk of request) body+=chunk;
    assert.deepEqual(JSON.parse(body),{eventIds:[event.eventId]});
    assert.equal(store.list(2).length,1,'SQLite must commit before acknowledgement');
    acknowledgements++;
    if(acknowledgements===1) { response.statusCode=503; return response.end('{}'); }
    acknowledged=true; response.end('{}');
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const stop=createRecovery({backendUrl:`http://127.0.0.1:${server.address().port}`,key:'synthetic-recovery-key',
    save:event=>{store.save(event);saved++;},log:()=>{},intervalMs:20});
  try {
    const deadline=Date.now()+5000;
    while(!acknowledged && Date.now()<deadline) await delay(20);
    assert.equal(acknowledged,true); assert.equal(saved,2); assert.equal(acknowledgements,2);
    assert.equal(store.list(2).length,1); assert.equal(store.list(3).length,1);
    assert.match(store.list(2)[0].message,/concluído/);
  } finally { stop(); await new Promise(resolve=>server.close(resolve)); store.close(); }
});
