import {dayOf,shiftDay,eventTime,newEventId,toInstant} from './model.js';
import {importSeriesIcs} from './series-ics.js';

export const SERIES_JOURNAL_START='2000-01-03T00:00:00Z',SERIES_JOURNAL_END='2000-01-04T00:00:00Z';
export function seriesJournal(row){try{const data=JSON.parse(row.description || 'null');if(data?.planning_series_journal!==1)return null;if(typeof data.id!=='string'||typeof data.master_uid!=='string'||typeof data.model?.rrule!=='string'||(data.complete&&!data.model.rrule)||!data.exceptions||typeof data.exceptions!=='object'||Array.isArray(data.exceptions))throw 0;return {...data,_uid:row.uid,_raw:row.description};}catch{if(row.description?.includes('planning_series_journal'))throw new Error('Le journal des exceptions est invalide. Aucune série modifiée.');return null;}}
export function seriesOwner(event,records){return records.find(r=>r.master_uid===event.uid || Object.values(r.exceptions).some(x=>x.uid===event.uid));}
export function seriesDay(event,record,zone){const known=Object.entries(record.exceptions).find(([,x])=>x.uid===event.uid && !x.native)?.[0];if(known)return known;const rid=event.recurrence_id,utc=rid?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);if(utc)return dayOf(`${utc[1]}-${utc[2]}-${utc[3]}T${utc[4]}:${utc[5]}:${utc[6]}Z`,zone);return rid?.match(/^\d{8}T/)?`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`:dayOf(event.start,zone);}
export function annotateSeries(events,records){return events.map(event=>{const owner=seriesOwner(event,records);return owner?{...event,series_id:owner.id,series_master_uid:owner.master_uid,series_rule:owner.model.rrule}:event;});}
export function sameSeriesEvent(saved,event){return !!saved && Date.parse(saved.start ?? saved.dtstart)===Date.parse(event.dtstart) && Date.parse(saved.end ?? saved.dtend)===Date.parse(event.dtend) && saved.summary===event.summary && (saved.description || '')===(event.description || '') && (!Object.hasOwn(event,'location') || saved.location===event.location);}
function pendingDescription(token,slot){return JSON.stringify({planning_series_pending:token,slot});}
function savedData(record){return Object.fromEntries(Object.entries(record).filter(([key])=>!key.startsWith('_')));}
function liveDescription(description,id){try{const m=JSON.parse(description);return m?.planning===2?JSON.stringify({...m,series_journal:id}):description;}catch{return description;}}

export class PlanningSeriesStore {
  constructor(getHass,calendar,zone,getNow=()=>Date.now()){this.getHass=getHass;this.calendar=calendar;this.zone=zone;this.getNow=getNow;}
  async rows(start,end){const query=new URLSearchParams({start,end}),rows=await this.getHass().callApi('GET',`calendars/${this.calendar}?${query}`);if(!Array.isArray(rows))throw new Error('Réponse calendrier invalide.');return rows.map(row=>({...row,start:eventTime(row.start,this.zone),end:eventTime(row.end,this.zone)}));}
  async records(){const records=(await this.rows(SERIES_JOURNAL_START,SERIES_JOURNAL_END)).map(seriesJournal).filter(Boolean);if(new Set(records.map(r=>r.id)).size!==records.length || new Set(records.map(r=>r.master_uid)).size!==records.length)throw new Error('Plusieurs journaux correspondent à cette série. Aucune modification effectuée.');return records;}
  async read(event,events=[]){
    const records=await this.records(),known=seriesOwner(event,records);if(known)return known;
    const origin=event.meta?.series_origin,rule=event.rrule || event.series_rule || events.find(e=>e.uid===event.uid && e.rrule)?.rrule || origin?.rrule || '';
    if(!rule && !event.recurrence_id)throw new Error('Règle de répétition indisponible. Ouvrez une occurrence habituelle.');
    return {planning_series_journal:1,id:newEventId(),master_uid:event.uid,complete:!!origin && !event.meta?.series_journal,model:{dtstart:event.start,dtend:event.end,summary:event.summary,description:event.description || '',rrule:rule,...origin},exceptions:{},pending:null};
  }
  import(record,text){const imported=importSeriesIcs(text,record.master_uid,this.zone);return {...record,model:imported.model,exceptions:{...imported.exceptions,...record.exceptions},complete:true};}
  async assertCurrent(record){if(!record._uid)return;const current=(await this.records()).find(r=>r._uid===record._uid);if(!current || current._raw!==record._raw)throw new Error('La série ou une de ses exceptions a changé. Fermez puis rouvrez la programmation.');}
  async persist(record){
    await this.assertCurrent(record);const description=JSON.stringify(savedData(record));
    const payload={type:`calendar/event/${record._uid?'update':'create'}`,entity_id:this.calendar,...(record._uid?{uid:record._uid}:{}),event:{dtstart:SERIES_JOURNAL_START,dtend:SERIES_JOURNAL_END,summary:'Planning — exceptions',description}};
    let error;try{await this.getHass().callWS(payload);}catch(e){error=e;}
    const confirmed=(await this.records()).filter(r=>r.id===record.id && r._raw===description);if(confirmed.length!==1)throw error || new Error('Le journal des exceptions n’a pas pu être enregistré.');
    record._uid=confirmed[0]._uid;record._raw=description;return record;
  }
  async dayRows(day){return this.rows(toInstant(`${day}T00:00`,this.zone),toInstant(`${shiftDay(day,1)}T00:00`,this.zone));}
  async native(payload){
    if(!['calendar/event/create','calendar/event/update','calendar/event/delete'].includes(payload.type)||payload.entity_id!==this.calendar)throw new Error('Opération de calendrier invalide.');
    try{return await this.getHass().callWS(payload);}catch(error){
      if(payload.type.endsWith('/delete')){if(/no existing item/i.test(error?.message || ''))return;throw error;}
      const event=payload.event,day=dayOf(event.dtstart,this.zone),rows=await this.dayRows(day);
      if(rows.some(row=>(!payload.uid || row.uid===payload.uid) && (!payload.recurrence_id || row.recurrence_id===payload.recurrence_id) && sameSeriesEvent(row,event)))return;
      throw error;
    }
  }
  async guard(record){
    const today=dayOf(this.getNow(),this.zone),ids=new Set([record.master_uid,...Object.values(record.exceptions).map(e=>e.uid).filter(Boolean)]),now=this.getNow();
    for(const row of await this.rows(toInstant(`${shiftDay(today,-1)}T00:00`,this.zone),toInstant(`${shiftDay(today,2)}T00:00`,this.zone))){let m;try{m=JSON.parse(row.description);}catch{}if(ids.has(row.uid)&&m?.has_end&&Date.parse(row.start)<=now&&now<Date.parse(row.end))throw new Error('Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.');}
  }
  async occurrence(original,payload){
    const record=await this.read(original),day=seriesDay(original,record,this.zone);if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');
    const entry=payload.type.endsWith('/delete')?{deleted:true}:{event:{...payload.event},uid:original.uid,...(payload.recurrence_id?{native:true,recurrence_id:payload.recurrence_id}:{})};
    record.pending={kind:'occurrence',payload,day,actual_day:dayOf(original.start,this.zone),entry};await this.persist(record);await this.recover(record);return record;
  }
  async update(record,event){
    if(!record.complete)throw new Error('Importez une fois le fichier ICS pour conserver toutes les exceptions de cette ancienne série.');
    if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');
    if(!Number.isFinite(Date.parse(event.dtstart)) || Date.parse(event.dtstart)<this.getNow()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');
    await this.guard(record);
    for(const entry of Object.values(record.exceptions))if(entry.event && (!entry.uid || entry.uid===record.master_uid)){const start=Date.parse(entry.event.dtstart);if(start>=this.getNow()-90000 && start<this.getNow()+20*60000)throw new Error('Une exception commence bientôt. Réessayez après son exécution.');}
    const model={...event,description:liveDescription(event.description,record.id)},exceptions=structuredClone(record.exceptions);
    record.pending={kind:'series',token:newEventId(),model,exceptions,old_uid:record.master_uid,new_uid:'',phase:'prepare'};
    await this.persist(record);await this.recover(record);return record;
  }
  async createStaged(record,slot,event){
    const description=pendingDescription(record.pending.token,slot),staged={...event,description};let rows=await this.dayRows(dayOf(event.dtstart,this.zone)),same=rows.find(row=>sameSeriesEvent(row,staged));
    if(!same){await this.native({type:'calendar/event/create',entity_id:this.calendar,event:staged});rows=await this.dayRows(dayOf(event.dtstart,this.zone));same=rows.find(row=>sameSeriesEvent(row,staged));}
    if(!same?.uid)throw new Error('Le nouvel événement n’a pas pu être retrouvé. Actualisez pour reprendre la sauvegarde.');return same.uid;
  }
  async recover(record){
    const plan=record.pending;if(!plan)return record;await this.assertCurrent(record);
    if(!['occurrence','series','delete'].includes(plan.kind))throw new Error('Opération de calendrier invalide.');
    if(plan.kind==='occurrence'){
      const p=plan.payload;
      if(p.type.endsWith('/delete')){const rows=await this.dayRows(plan.actual_day);if(rows.some(row=>row.uid===p.uid && (!p.recurrence_id || row.recurrence_id===p.recurrence_id)))await this.native(p);}
      else await this.native(p);
      record.exceptions[plan.day]=plan.entry;record.pending=null;return this.persist(record);
    }
    if(plan.kind==='delete'){
      for(const uid of plan.uids){await this.assertCurrent(record);await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid});}
      await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:record._uid});return record;
    }
    if(plan.phase==='prepare'){
      if(!plan.new_uid){plan.new_uid=await this.createStaged(record,'master',plan.model);await this.persist(record);}
      for(const [day,entry] of Object.entries(plan.exceptions))if(entry.event && (!entry.uid || entry.uid===plan.old_uid)){
        entry.uid=await this.createStaged(record,day,entry.event);delete entry.native;delete entry.recurrence_id;entry.staged=true;await this.persist(record);
      }
      for(const day of Object.keys(plan.exceptions)){
        await this.assertCurrent(record);for(const row of await this.dayRows(day))if(row.uid===plan.new_uid && row.recurrence_id)await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:row.uid,recurrence_id:row.recurrence_id});
      }
      plan.phase='activate';await this.persist(record);
    }
    if(plan.phase==='activate'){
      await this.assertCurrent(record);await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:plan.old_uid});
      // Only the master belongs to this UID. Its start/rule stay unchanged, so
      // Local Calendar retains the EXDATEs while this description is activated.
      await this.native({type:'calendar/event/update',entity_id:this.calendar,uid:plan.new_uid,event:plan.model});
      for(const entry of Object.values(plan.exceptions))if(entry.staged){await this.assertCurrent(record);await this.native({type:'calendar/event/update',entity_id:this.calendar,uid:entry.uid,event:entry.event});delete entry.staged;}
      record.master_uid=plan.new_uid;record.model=plan.model;record.exceptions=plan.exceptions;record.pending=null;await this.persist(record);
    }
    return record;
  }
  async deleteSeries(original){const record=await this.read(original);if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');await this.guard(record);record.pending={kind:'delete',uids:[...new Set([record.master_uid,...Object.values(record.exceptions).map(x=>x.uid).filter(Boolean)])]};await this.persist(record);await this.recover(record);}
}
