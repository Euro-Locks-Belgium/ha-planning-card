import {eventTime, metadata, localMinute, dayOf, toInstant, shiftDay, weekday, newEventId, eventColor, MIN_LEAD_MINUTES} from './model.js';
import {normalizeAppearance} from './views.js';
import {planningLanguage} from './i18n.js';

export const ACTION_TYPES = {
  switch: {label:'Interrupteur', operations:{on:'Allumer',off:'Éteindre'}},
  light: {label:'Éclairage', operations:{on:'Allumer',off:'Éteindre'}},
  input_boolean: {label:'Commande', operations:{on:'Activer',off:'Désactiver'}},
  cover: {label:'Barrière / volet', operations:{open:'Ouvrir',close:'Fermer',stop:'Arrêter'}},
  script: {label:'Script', operations:{run:'Lancer le script'}},
  scene: {label:'Scène', operations:{run:'Activer la scène'}},
  button: {label:'Bouton', operations:{press:'Appuyer'}},
  input_button: {label:'Bouton', operations:{press:'Appuyer'}},
  frech: {label:'Frech', operations:{start:'Démarrer avec contrôle',off:'Éteindre'}},
};
// UI fixes reuse the already published, unchanged execution blueprint.
export const ACTION_BLUEPRINT_VERSION='0.6.0';
export function selectedPlanningEntities(input=[]){
  if(!Array.isArray(input) || input.length>200)throw new Error('La sélection doit contenir au maximum 200 entités.');
  for(const entity of input)if(typeof entity!=='string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity) || ![...Object.keys(ACTION_TYPES).filter(t=>t!=='frech'),'binary_sensor'].includes(entity.split('.')[0]))throw new Error('Un appareil sélectionné est incompatible.');
  return [...new Set(input)];
}
export function targetEntity(record) { return record.entity_id || record.switch_entity || record.script_entity || ''; }
export function operationsFor(record) { return ACTION_TYPES[record?.type]?.operations || {}; }
export function defaultOperation(record) { return Object.keys(operationsFor(record))[0] || ''; }
export function oppositeOperation(op) { return ({on:'off',off:'on',open:'close',close:'open',start:'off'})[op] || ''; }
export function simpleActionRecord(entity, name) {
  const type=entity.split('.')[0];
  if (!Object.hasOwn(ACTION_TYPES,type) || type === 'frech' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity)) throw new Error('Choisissez une entité compatible.');
  return {id:`entity_${entity.replace('.','_')}`,name:name || entity,type,entity_id:entity,enabled:true};
}
export function validateActionRecord(record) {
  if (!record || !/^[a-z0-9_]+$/.test(record.id || '') || typeof record.name !== 'string' || !record.name.trim() || record.name.length>120 || typeof record.enabled !== 'boolean' || !Object.hasOwn(ACTION_TYPES,record.type)) return 'Action autorisée invalide.';
  if (record.type === 'frech') {
    if (!/^switch\.[a-z0-9_]+$/.test(record.switch_entity || '') || !/^script\.[a-z0-9_]+$/.test(record.script_entity || '') || !/^binary_sensor\.[a-z0-9_]+$/.test(record.input_entity || '') || !Number.isInteger(record.frech_number) || record.frech_number<1 || record.frech_number>21) return 'Configuration du démarrage Frech incomplète.';
  } else if (!new RegExp(`^${record.type}\\.[a-z0-9_]+$`).test(targetEntity(record))) return 'L’entité ne correspond pas au type d’action.';
  return '';
}
export function normalizePlanningConfig(input) {
  const config={title:'Planning',calendar:'',language:'auto',demo:!input.calendar,...input,entities:selectedPlanningEntities(input.entities),appearance:normalizeAppearance(input.appearance)};
  planningLanguage(config.language);
  if(config.calendar && !/^calendar\.[a-z0-9_]+$/.test(config.calendar)) throw new Error('Choisissez un calendrier Home Assistant.');
  if(config.execution_automation && !/^automation\.[a-z0-9_]+$/.test(config.execution_automation)) throw new Error('Automatisation invalide.');
  delete config.groups; delete config.closure_calendar; delete config.devices;
  return config;
}
export function scheduleMetadata(description) {
  try {
    const m=JSON.parse(description || 'null');
    if(m?.planning !== 2 || m.kind !== 'schedule' || typeof m.id !== 'string' || typeof m.has_end !== 'boolean') return null;
    const valid=list=>Array.isArray(list) && list.length<=50 && new Set(list.map(a=>a?.target)).size===list.length && list.every(a=>a && /^[a-z0-9_]+$/.test(a.target || '') && ['on','off','open','close','stop','run','press','start'].includes(a.op));
    if(!valid(m.start_actions) || !m.start_actions.length || !valid(m.end_actions) || (m.has_end !== (m.end_actions.length>0))) return null;
    return m;
  } catch {return null;}
}
export function normalizeSchedule(raw,calendar,zone) {
  const meta=scheduleMetadata(raw.description), legacy=meta ? null : metadata(raw.description);
  const start=eventTime(raw.start,zone),end=eventTime(raw.end,zone);
  return {...raw,calendar,start,end,meta,legacy,role:meta?'schedule':legacy?.kind==='closure'?'legacy-closure':legacy?'legacy':'external',key:`${calendar}|${raw.uid || raw.summary}|${raw.recurrence_id || start}`};
}
export function recurring(event) {return !!(event.rrule || event.recurrence_id);}
export function sameOccurrence(a,b) {return a.calendar===b.calendar && a.uid===b.uid && (a.recurrence_id || '')===(b.recurrence_id || '');}
export function occurrenceSelector(event,scope='occurrence') {
  if(!event.uid) throw new Error('Cet événement ne possède pas d’identifiant modifiable.');
  if(scope==='occurrence' && recurring(event)) {
    if(typeof event.recurrence_id !== 'string' || !event.recurrence_id) throw new Error('Ce calendrier ne fournit pas l’identifiant de cette occurrence. La série n’a pas été modifiée.');
    return {uid:event.uid,recurrence_id:event.recurrence_id};
  }
  return {uid:event.uid};
}
export function schedulePayload(draft) {
  const event={dtstart:draft.start,dtend:draft.end,summary:draft.summary.trim(),description:JSON.stringify({planning:2,kind:'schedule',id:draft.event_id || newEventId(),color:eventColor(draft.color),has_end:!!draft.has_end,start_actions:draft.start_actions,end_actions:draft.has_end?draft.end_actions:[],note:draft.note || ''})};
  if(draft.rrule && (!draft.uid || draft.scope==='series')) event.rrule=draft.rrule;
  return {type:`calendar/event/${draft.uid?'update':'create'}`,entity_id:draft.calendar,...(draft.uid?occurrenceSelector(draft,draft.scope):{}),event};
}
export function occurrenceDeletePayload(event,scope='occurrence') {return {type:'calendar/event/delete',entity_id:event.calendar,...occurrenceSelector(event,scope)};}
export function calendarEditPayload(original,changes){
  const event={dtstart:changes.start,dtend:changes.end,summary:changes.summary ?? original.summary,description:changes.description ?? original.description ?? ''};
  if(typeof original.location==='string')event.location=original.location;
  return {type:'calendar/event/update',entity_id:original.calendar,...occurrenceSelector(original),event};
}
export function wallDuration(event,zone) {return (Date.parse(`${localMinute(event.end,zone)}:00Z`)-Date.parse(`${localMinute(event.start,zone)}:00Z`))/60000;}
export function shiftedOccurrence(event,date,minute,zone) {
  const startWall=`${date}T${minute===undefined?localMinute(event.start,zone).slice(11):`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`}`;
  const duration=wallDuration(event,zone),endWall=new Date(Date.parse(`${startWall}:00Z`)+duration*60000).toISOString().slice(0,16);
  return {start:toInstant(startWall,zone),end:toInstant(endWall,zone)};
}
export function activeSlot(event,now=Date.now()) {return !!event.meta?.has_end && Date.parse(event.start)<=now && now<Date.parse(event.end);}
export function mutationIssue(event,scope,events,now=Date.now()) {
  if((scope==='series'?events.filter(e=>e.uid===event.uid && e.calendar===event.calendar):[event]).some(e=>activeSlot(e,now))) return 'Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.';
  return '';
}
export function validateSchedule(draft,records,now=Date.now(),demo=false) {
  if(!Number.isFinite(Date.parse(draft.start)) || !Number.isFinite(Date.parse(draft.end)) || Date.parse(draft.end)<=Date.parse(draft.start)) return 'La fin doit être après le début.';
  if(!demo && Date.parse(draft.start)<now+MIN_LEAD_MINUTES*60000) return `Prévoyez au moins ${MIN_LEAD_MINUTES} minutes avant le début.`;
  if(!draft.start_actions?.length) return 'Ajoutez au moins une action au début.';
  if(draft.has_end && !draft.end_actions?.length) return 'Choisissez l’action à exécuter à la fin.';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]])if(list.length>50 || new Set(list.map(a=>a.target)).size!==list.length)return 'Choisissez une seule action par appareil à chaque étape (50 maximum).';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]]) for(const a of list) {
    const record=records.find(r=>r.id===a.target);
    if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),a.op)) return 'Une action est absente, désactivée ou incompatible. Vérifiez la sélection.';
  }
  return '';
}
export function weeklyStart(date,time,days,zone,now=Date.now(),demo=false) {
  if(!days.length) throw new Error('Choisissez au moins un jour de répétition.');
  for(let offset=0;offset<14;offset++) {
    const day=shiftDay(date,offset);
    if(days.includes(weekday(day))) {const instant=toInstant(`${day}T${time}`,zone);if(demo || Date.parse(instant)>=now+MIN_LEAD_MINUTES*60000) return instant;}
  }
  throw new Error('Choisissez une date de début future.');
}
export function scheduleFingerprint(event) {return JSON.stringify([event.summary,event.description || '',event.start,event.end,event.rrule || '',event.recurrence_id || '']);}
export function matchesSavedSchedule(event,draft) {
  const payload=schedulePayload(draft).event;
  return event.uid===draft.uid && event.start===draft.start && event.end===draft.end && event.summary===payload.summary && JSON.stringify(scheduleMetadata(event.description))===JSON.stringify(scheduleMetadata(payload.description));
}
export function packWeekEvents(events,zone,pixelsPerHour=48) {
  const placed=[];
  for(const event of [...events].sort((a,b)=>a.start.localeCompare(b.start))) {
    const time=localMinute(event.start,zone).slice(11),minute=Number(time.slice(0,2))*60+Number(time.slice(3));
    const end=Math.max(minute+35*60/pixelsPerHour,minute+(event.meta?.has_end?Math.max(5,wallDuration(event,zone)):5));
    let lane=0;while(placed.some(p=>p.lane===lane && p.minute<end && minute<p.visualEnd))lane++;
    placed.push({event,minute,visualEnd:Math.min(1440,end),lane});
  }
  const count=Math.max(1,...placed.map(p=>p.lane+1));return placed.map(p=>({...p,lanes:count}));
}
