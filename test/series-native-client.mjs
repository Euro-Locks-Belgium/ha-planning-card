import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {PlanningSeriesStore} from '../src/series-store.js';
import {normalizeSchedule} from '../src/actions-model.js';
const responses=createInterface({input:process.stdin,crlfDelay:Infinity}),queue=[];
responses.on('line',line=>{const value=JSON.parse(line),pending=queue.shift();value.error?pending.reject(value.error):pending.resolve(value.result);});
function rpc(type,args={}){return new Promise((resolve,reject)=>{queue.push({resolve,reject});process.stdout.write(JSON.stringify({type,...args})+'\n');});}
const zone='Europe/Brussels',hass={callApi:(method,path)=>rpc('api',{method,path}),callWS:payload=>rpc('ws',{payload})},store=new PlanningSeriesStore(()=>hass,'calendar.test',zone,()=>Date.parse('2026-11-05T10:00Z'));
try{
  const selected=normalizeSchedule((await store.dayRows('2026-11-09')).find(r=>r.uid==='weekly'),'calendar.test',zone);
  let record=await store.read(selected);
  if(process.argv[2]==='unknown'){await assert.rejects(store.update(record,{...record.model,dtstart:'2026-11-09T07:00Z'}),/ICS/);}
  else{
    record=store.import(record,await rpc('ics'));
    const changed={...record.model,dtstart:'2026-11-09T07:00:00Z',dtend:'2026-11-09T07:01:00Z',summary:'Updated'};
    await store.update(record,changed);
    const visible=()=>store.rows('2026-11-01T00:00Z','2026-12-05T00:00Z');
    let rows=await visible();assert.deepEqual(rows.map(r=>[r.start.slice(8,10),r.start.slice(11,16)]).sort(),[['09','07:00'],['18','05:40'],['30','07:00']]);
    const moved=rows.find(r=>r.summary==='Moved');assert.equal(moved.description,'Personal actions');
    // Retain the journal and all native EXDATEs through an ICS save/reload.
    await rpc('reload');record=(await store.records())[0];
    await store.update(record,{...changed,rrule:'FREQ=WEEKLY;COUNT=4;BYDAY=MO,WE'});
    await store.update(record,{...changed,dtstart:'2026-11-09T08:00:00Z',dtend:'2026-11-09T08:01:00Z'});
    rows=await visible();assert.deepEqual(rows.map(r=>r.start.slice(8,10)).sort(),['09','18','30']);assert.equal(rows.find(r=>r.summary==='Moved').start,'2026-11-18T05:40:00.000Z');
    // A preserved detached occurrence is an independent native event but remains
    // part of the logical series through its shared calendar journal.
    const original=normalizeSchedule(rows.find(r=>r.summary==='Moved'),'calendar.test',zone);
    await store.occurrence(original,{type:'calendar/event/update',entity_id:'calendar.test',uid:original.uid,event:{dtstart:'2026-11-19T04:00Z',dtend:'2026-11-19T04:01Z',summary:'Moved again',description:'Personal actions'}});
    record=(await store.records())[0];await store.update(record,changed);
    assert.equal((await store.dayRows('2026-11-19')).filter(r=>r.summary==='Moved again').length,1);
    if(process.argv[2]==='far'){record=(await store.records())[0];await store.update(record,{...changed,rrule:'FREQ=WEEKLY;BYDAY=MO'});assert.equal((await store.dayRows('2031-11-17')).length,0);assert.equal((await store.dayRows('2031-11-10')).length,1);}
    const last=normalizeSchedule((await store.dayRows('2026-11-30'))[0],'calendar.test',zone);await store.deleteSeries(last);
    assert.equal((await visible()).length,0);assert.equal((await store.records()).length,0);
  }
  process.stdout.write(JSON.stringify({type:'done'})+'\n');responses.close();process.exit(0);
}catch(error){process.stderr.write(String(error.stack || error)+'\n');responses.close();process.exit(1);}
