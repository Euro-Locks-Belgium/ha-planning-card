import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/devices.js';
import { normalizeAppearance, visibleWeekdays } from '../src/views.js';
import { viewRange, validateDraft } from '../src/model.js';
const clone = value => JSON.parse(JSON.stringify(value));
const device = (extra = {}) => ({id:'machine_a',name:'Machine A',type:'switch',enabled:true,switch_entity:'switch.machine_a',...extra});
function fixture(admin = true) {
  let config = {id:'managed',alias:'Planning',description:'Conserver cette description',use_blueprint:{path:'example/planning-devices.yaml',input:{planning_calendar:'calendar.planning',test_mode:true,wait_time:10,interval_seconds:60,machine_catalog:{machine_a:D.deviceRecord(device())}}}};
  let rows = [], loseConfigReply = false, loseRegistryReply = false;
  const calls = [];
  const hass = {user:{is_admin:admin},states:{'automation.planning':{entity_id:'automation.planning',state:'on',attributes:{id:'managed',current:0}}},
    async callApi(method,path,body) {
      calls.push({method,path,body:body && clone(body)});
      if (path.startsWith('calendars/')) return clone(rows);
      if (!this.user.is_admin) throw new Error('Forbidden');
      if (method === 'GET') { if (this.beforeRead) this.beforeRead(); return clone(config); }
      if (this.failConfig) throw new Error('Sauvegarde refusée');
      config = clone(body);
      if (loseConfigReply) {loseConfigReply=false;throw new Error('Réponse perdue');}
      return {result:'ok'};
    },
    async callWS(request) {
      calls.push(clone(request));
      if(this.failRegistry) throw new Error('Publication refusée');
      if(request.type.endsWith('/delete')) rows=rows.filter(r => r.uid !== request.uid);
      else {const record={...request.event,uid:request.uid || `registry_${rows.length}`,start:request.event.dtstart,end:request.event.dtend};const index=rows.findIndex(r => r.uid === request.uid);if(index<0)rows.push(record);else rows[index]=record;}
      if(loseRegistryReply){loseRegistryReply=false;throw new Error('Réponse perdue');}
    },
  };
  const store = new D.PlanningDeviceStore(()=>hass,'calendar.planning','automation.planning');
  return {hass,store,calls,get config(){return config;},set config(value){config=value;},get rows(){return rows;},set rows(value){rows=value;},loseConfigReply(){loseConfigReply=true;},loseRegistryReply(){loseRegistryReply=true;}};
}

test('catalogue typé : relais, script et Frech ; paramètres invalides refusés', () => {
  assert.equal(D.validateDevice(device()),'');
  assert.equal(D.validateDevice(device({type:'script',script_entity:'script.machine'})),'');
  assert.equal(D.validateDevice(device({type:'frech',script_entity:'script.start',input_entity:'binary_sensor.input',frech_number:3})), '');
  for(const change of [{type:'call_service'},{enabled:'false'},{switch_entity:'script.injection'},{name:123},{id:'invalid.id'}]) assert.notEqual(D.validateDevice(device(change)),'');
});
test('chargement administrateur et liaison au bon blueprint/calendrier',async()=>{
  const f=fixture();const loaded=await f.store.load();assert.deepEqual(loaded.devices,[device()]);assert.equal(loaded.needsPublish,true);
  const wrong=clone(f.config);wrong.use_blueprint.path='example/planning-frech.yaml';assert.throws(()=>D.devicesFromAutomation(wrong,'calendar.planning'),/configurables/);
  assert.throws(()=>D.devicesFromAutomation(f.config,'calendar.other'),/même calendrier/);
});
test('ajout et renommage enregistrés dans l’automatisation, sans changer ses autres réglages',async()=>{
  const f=fixture(), before=clone(f.config), snapshot=await f.store.load();
  const saved=await f.store.save(snapshot,[device({name:'Nouveau nom'}),device({id:'machine_b',name:'Machine B',switch_entity:'switch.machine_b'})]);
  assert.equal(saved.needsPublish,false);assert.equal(saved.devices.length,2);assert.equal(f.config.description,before.description);assert.equal(f.config.use_blueprint.input.test_mode,true);assert.equal(f.config.use_blueprint.input.interval_seconds,60);
  assert.equal(f.config.use_blueprint.input.machine_catalog.machine_a.name,'Nouveau nom');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('la liste publique ne contient que les noms/identifiants ; aucun paramètre de commande',async()=>{
  const f=fixture();await f.store.save(await f.store.load(),[device()]);
  const meta=JSON.parse(f.rows[0].description);
  assert.deepEqual(meta.devices,[{id:'machine_a',name:'Machine A',enabled:true,type:'switch'}]);
  assert.equal(f.rows[0].start,D.DEVICE_REGISTRY_START);
  assert.ok(!f.rows[0].description.includes('switch.machine_a'));
});
test('utilisateur classique : lecture de la liste et aucun accès à la configuration technique',async()=>{
  const f=fixture();await f.store.save(await f.store.load(),[device()]);f.calls.length=0;f.hass.user.is_admin=false;
  const loaded=await f.store.load();assert.equal(loaded.devices[0].name,'Machine A');assert.ok(f.calls.every(c=>c.path.startsWith('calendars/')));
  await assert.rejects(f.store.save(loaded,[]),/administrateurs/);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('désactivation enregistrée côté exécution avant une éventuelle panne de publication',async()=>{
  const f=fixture();f.hass.failRegistry=true;
  const saved=await f.store.save(await f.store.load(),[device({enabled:false})]);
  assert.equal(saved.needsPublish,true);assert.equal(f.config.use_blueprint.input.machine_catalog.machine_a.enabled,false);
  f.hass.failRegistry=false;await f.store.publish(saved.devices);assert.equal(JSON.parse(f.rows[0].description).devices[0].enabled,false);
});
test('suppression retire l’identifiant du catalogue d’exécution',async()=>{
  const f=fixture();const saved=await f.store.save(await f.store.load(),[]);
  assert.deepEqual(saved.devices,[]);assert.deepEqual(f.config.use_blueprint.input.machine_catalog,{});
});
test('modification concurrente de l’automatisation détectée avant toute écriture',async()=>{
  const f=fixture(),snapshot=await f.store.load();f.config.description='Autre modification';
  await assert.rejects(f.store.save(snapshot,[device({name:'A'})]),/a changé/);
  assert.ok(!f.calls.some(c=>c.method==='POST'||c.type));
});
test('configuration interdite pendant une séquence, y compris après la relecture',async()=>{
  const f=fixture(),snapshot=await f.store.load();f.hass.states['automation.planning'].attributes.current=1;
  await assert.rejects(f.store.save(snapshot,[]),/séquence/);
  f.hass.states['automation.planning'].attributes.current=0;f.hass.beforeRead=()=>{f.hass.states['automation.planning'].attributes.current=1;};
  await assert.rejects(f.store.save(snapshot,[]),/séquence/);assert.ok(!f.calls.some(c=>c.method==='POST'));
});
test('réponse POST perdue : relecture et confirmation sans double sauvegarde',async()=>{
  const f=fixture();f.loseConfigReply();const result=await f.store.save(await f.store.load(),[device({name:'Renommée'})]);
  assert.equal(result.devices[0].name,'Renommée');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('refus de sauvegarde : liste et catalogue conservés',async()=>{
  const f=fixture(),snapshot=await f.store.load();f.hass.failConfig=true;
  await assert.rejects(f.store.save(snapshot,[]),/refusée/);assert.equal(f.rows.length,0);assert.equal(Object.keys(f.config.use_blueprint.input.machine_catalog).length,1);
});
test('réponse calendrier perdue : pas de second événement de liste',async()=>{
  const f=fixture();f.loseRegistryReply();await f.store.save(await f.store.load(),[device()]);await f.store.publish([device()]);assert.equal(f.rows.length,1);
});
test('doublons de liste réparés sans toucher aux événements externes',async()=>{
  const f=fixture();const payload=D.deviceRegistryPayload('calendar.planning','automation.planning',[device()]);
  f.rows=[{...payload.event,uid:'one'},{...payload.event,uid:'two'},{uid:'external',description:'Autre événement'}];await f.store.publish([device()]);assert.deepEqual(f.rows.map(r=>r.uid),['one','external']);
});
test('une liste publique falsifiée ne modifie jamais le catalogue d’exécution',async()=>{
  const f=fixture();const payload=D.deviceRegistryPayload('calendar.planning','automation.planning',[device({switch_entity:'switch.injection'})]);
  const meta=JSON.parse(payload.event.description);meta.devices[0].switch_entity='switch.injection';f.rows=[{...payload.event,uid:'fake',description:JSON.stringify(meta)}];
  f.hass.user.is_admin=false;const loaded=await f.store.load();assert.equal(loaded.devices[0].switch_entity,undefined);assert.equal(f.config.use_blueprint.input.machine_catalog.machine_a.switch_entity,'switch.machine_a');
});
test('appareil désactivé ou absent refusé dans une programmation',()=>{
  const draft={kind:'restart',calendar:'calendar.p',summary:'A',start:'2030-01-01T00:00:00Z',end:'2030-01-01T00:05:00Z',devices:['machine_a']};
  assert.match(validateDraft(draft,[],'Europe/Brussels',0,true,[device({enabled:false})]),/désactivé/);
  assert.match(validateDraft(draft,[],'Europe/Brussels',0,true,[]),/retiré/);
});
test('personnalisation validée, dimanche premier jour et week-ends masqués',()=>{
  assert.equal(normalizeAppearance().default_view,'month');assert.equal(normalizeAppearance({density:'compact'}).density,'compact');
  assert.deepEqual(visibleWeekdays(0,false),[1,2,3,4,5]);assert.equal(viewRange('2026-11',0).start,'2026-11-01');
  assert.throws(()=>normalizeAppearance({accent_color:'red;display:none'}));assert.throws(()=>normalizeAppearance({first_day:6}));
});
