import {stableJson,DEVICE_REGISTRY_START,DEVICE_REGISTRY_END} from './devices.js';
import {targetEntity,validateActionRecord,simpleActionRecord,operationsFor} from './actions-model.js';

export function actionCatalog(config,calendar) {
  if(!/(^|\/)planning-actions\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar) throw new Error('Choisissez l’exécution Planning de ce calendrier.');
  const raw=config.use_blueprint.input.action_catalog || {};
  if(typeof raw!=='object' || Array.isArray(raw)) throw new Error('La liste des actions autorisées est invalide.');
  return Object.entries(raw).map(([id,r])=>{const record={...r,id,name:r.name || id,enabled:r.enabled===undefined?true:r.enabled};const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;});
}
export function publicActionCatalog(records) {return records.map(r=>({id:r.id,name:r.name,type:r.type,entity_id:targetEntity(r),enabled:r.enabled}));}
export function importedActionCatalog(config,calendar){
  if(!/(^|\/)planning-(devices|frech)\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar)return [];
  return Object.entries(config.use_blueprint.input.machine_catalog || {}).map(([id,r])=>{
    const type=r.type || 'frech',record={...r,id,type,name:r.name || `Frech ${r.frech_number || id}`,enabled:r.enabled!==false};
    if(type==='switch')record.entity_id=r.switch_entity;if(type==='script')record.entity_id=r.script_entity;
    if(type==='frech' && !record.script_entity)record.script_entity=config.use_blueprint.input.startup_script;
    const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;
  });
}
export function actionRegistry(row) {
  try {
    const m=JSON.parse(row.description || 'null');
    if(m?.planning_actions!==1 || !/^automation\.[a-z0-9_]+$/.test(m.automation || '') || !Array.isArray(m.actions))return null;
    if(m.actions.some(r=>!r || !/^[a-z0-9_]+$/.test(r.id || '') || typeof r.name!=='string' || typeof r.enabled!=='boolean' || !/^[a-z_]+\.[a-z0-9_]+$/.test(r.entity_id || '')))return null;
    return {automation:m.automation,test_mode:m.test_mode!==false,actions:publicActionCatalog(m.actions)};
  }catch{return null;}
}
export class PlanningActionStore {
  constructor(getHass,calendar,automation='') {this.getHass=getHass;this.calendar=calendar;this.automation=automation;}
  async registryRows() {
    const q=new URLSearchParams({start:DEVICE_REGISTRY_START,end:DEVICE_REGISTRY_END});
    const rows=await this.getHass().callApi('GET',`calendars/${this.calendar}?${q}`);
    if(!Array.isArray(rows))throw new Error('La configuration du planning est indisponible.');
    return rows.filter(row=>actionRegistry(row));
  }
  configPath() {const id=this.getHass().states[this.automation]?.attributes?.id || (this._createdState?.entity_id===this.automation?this._createdState.attributes.id:null);if(!id)throw new Error('Exécution du planning indisponible.');return `config/automation/config/${encodeURIComponent(id)}`;}
  assertAdminIdle() {
    if(this.getHass().user?.is_admin!==true)throw new Error('Un administrateur doit autoriser cette nouvelle entité une première fois.');
    if(Number(this.getHass().states[this.automation]?.attributes?.current || 0)>0)throw new Error('Une action est en cours. Attendez sa fin pour ajouter une nouvelle entité.');
  }
  async load() {
    const rows=await this.registryRows(), links=[...new Set(rows.map(r=>actionRegistry(r).automation))];
    if(links.length>1)throw new Error('Plusieurs exécutions sont associées à ce calendrier. Vérifiez la configuration.');
    if(links.length)this.automation=links[0];
    if(!this.automation)return {ready:false,records:[],test_mode:true};
    if(this.getHass().user?.is_admin===true) {
      const config=await this.getHass().callApi('GET',this.configPath());
      try {const records=actionCatalog(config,this.calendar),test_mode=config.use_blueprint.input.test_mode!==false;const expected={automation:this.automation,test_mode,actions:publicActionCatalog(records)};return {ready:true,config,records,fingerprint:stableJson(config),test_mode,needsPublish:rows.length!==1 || stableJson(actionRegistry(rows[0]))!==stableJson(expected)};}
      catch(error){if(!links.length)return {ready:false,records:importedActionCatalog(config,this.calendar),test_mode:true,legacy_automation:this.automation};throw error;}
    }
    if(!rows.length)return {ready:false,records:[],test_mode:true};
    const meta=actionRegistry(rows[0]);
    if(rows.some(r=>stableJson(actionRegistry(r))!==stableJson(meta)))throw new Error('Un administrateur doit actualiser la liste des actions autorisées.');
    return {ready:true,records:meta.actions,test_mode:meta.test_mode};
  }
  async publish(snapshot) {
    this.assertAdminIdle();
    const rows=await this.registryRows(), same=rows.filter(r=>actionRegistry(r).automation===this.automation);
    const description=JSON.stringify({planning_actions:1,automation:this.automation,test_mode:snapshot.test_mode,actions:publicActionCatalog(snapshot.records)});
    const payload={type:`calendar/event/${same[0]?'update':'create'}`,entity_id:this.calendar,...(same[0]?{uid:same[0].uid}:{}),event:{dtstart:DEVICE_REGISTRY_START,dtend:DEVICE_REGISTRY_END,summary:'Planning — configuration',description}};
    if(!same[0] || same[0].description!==description) {
      try{await this.getHass().callWS(payload);}catch(error){const fresh=await this.registryRows();if(!fresh.some(r=>r.description===description))throw error;}
    }
    for(const duplicate of same.slice(1))await this.getHass().callWS({type:'calendar/event/delete',entity_id:this.calendar,uid:duplicate.uid});
  }
  async save(snapshot,records) {
    this.assertAdminIdle();for(const r of records){const issue=validateActionRecord(r);if(issue)throw new Error(issue);}
    const current=await this.getHass().callApi('GET',this.configPath());actionCatalog(current,this.calendar);
    if(stableJson(current)!==snapshot.fingerprint)throw new Error('Les actions autorisées ont changé. Actualisez puis vérifiez votre programmation.');
    const updated=JSON.parse(JSON.stringify(current));updated.use_blueprint.input.action_catalog=Object.fromEntries(records.map(({id,...r})=>[id,r]));
    this.assertAdminIdle();
    try{await this.getHass().callApi('POST',this.configPath(),updated);}catch(error){const recovered=await this.getHass().callApi('GET',this.configPath());if(stableJson(recovered)!==stableJson(updated))throw error;}
    const confirmed=await this.getHass().callApi('GET',this.configPath());if(stableJson(confirmed)!==stableJson(updated))throw new Error('La sauvegarde des actions n’a pas pu être confirmée.');
    const result={ready:true,config:confirmed,records:actionCatalog(confirmed,this.calendar),fingerprint:stableJson(confirmed),test_mode:confirmed.use_blueprint.input.test_mode!==false};
    try{await this.publish(result);}catch{result.needsPublish=true;}return result;
  }
  async prepare(snapshot,rows) {
    const fresh=await this.load();if(!fresh.ready)throw new Error('Préparez d’abord l’exécution de ce calendrier dans les réglages de la carte.');
    const records=[...fresh.records], resolved=[];let added=false;
    for(const row of rows) {
      let record=records.find(r=>r.id===row.target);
      if(!record && row.target?.startsWith('entity:')) {
        this.assertAdminIdle();const entity=row.target.slice(7), state=this.getHass().states[entity];if(!state)throw new Error('Cette entité n’est plus disponible.');
        record=records.find(r=>targetEntity(r)===entity);
        if(!record){record=simpleActionRecord(entity,state.attributes?.friendly_name || entity);if(records.some(r=>r.id===record.id))throw new Error('Identifiant d’action déjà utilisé.');records.push(record);added=true;}
      }
      if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),row.op))throw new Error('Choisissez une action active et compatible.');
      const old=snapshot?.records.find(r=>r.id===record.id);
      if(old && snapshot.config && stableJson(old)!==stableJson(record))throw new Error('Cette action a changé depuis l’ouverture. Actualisez et recommencez.');
      resolved.push({target:record.id,op:row.op});
    }
    const saved=added?await this.save(fresh,records):fresh;return {snapshot:saved,actions:resolved};
  }
  async setup(version,legacyAutomation='') {
    if(!/^calendar\.[a-z0-9_]+$/.test(this.calendar || ''))throw new Error('Choisissez d’abord un calendrier local dans la configuration de la carte.');
    if(this.getHass().user?.is_admin!==true)throw new Error('La préparation du planning nécessite un administrateur Home Assistant.');
    const installed=await this.getHass().callWS({type:'blueprint/list',domain:'automation'});
    let path=Object.keys(installed).find(p=>/(^|\/)planning-actions\.yaml$/.test(p) && installed[p].metadata?.source_url?.startsWith('https://github.com/Euro-Locks-Belgium/ha-planning-card/'));
    if(!path) {
      if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Version de développement : importer manuellement le blueprint planning-actions.yaml pour tester dans Home Assistant.');
      const url=`https://github.com/Euro-Locks-Belgium/ha-planning-card/blob/v${version}/blueprints/planning-actions.yaml`;
      const imported=await this.getHass().callWS({type:'blueprint/import',url});
      if(imported.validation_errors && Object.keys(imported.validation_errors).length)throw new Error('Le blueprint téléchargé n’a pas été validé.');
      if(imported.exists)throw new Error('Un blueprint du même nom existe déjà. Vérifiez-le dans Home Assistant.');
      if(!/^[a-zA-Z0-9/_-]+$/.test(imported.suggested_filename || '') || !imported.suggested_filename.endsWith('planning-actions'))throw new Error('Nom du blueprint inattendu.');
      path=`${imported.suggested_filename}.yaml`;
      await this.getHass().callWS({type:'blueprint/save',domain:'automation',path,yaml:imported.raw_data,source_url:url});
    }
    const id=`planning_actions_${this.calendar.slice(9)}`, endpoint=`config/automation/config/${id}`;
    let config;
    try{config=await this.getHass().callApi('GET',endpoint);actionCatalog(config,this.calendar);}
    catch(error){
      if(![error.status_code,error.status].includes(404))throw error;
      let catalog={};
      if(legacyAutomation && this.getHass().states[legacyAutomation]?.attributes?.id) {
        const old=await this.getHass().callApi('GET',`config/automation/config/${encodeURIComponent(this.getHass().states[legacyAutomation].attributes.id)}`);
        if(/(^|\/)planning-(devices|frech)\.yaml$/.test(old.use_blueprint?.path || '') && old.use_blueprint.input?.planning_calendar===this.calendar) {
          catalog=Object.fromEntries(importedActionCatalog(old,this.calendar).map(({id,...r})=>[id,r]));
        }
      }
      config={id,alias:`Planning — ${this.getHass().states[this.calendar]?.attributes?.friendly_name || this.calendar}`,use_blueprint:{path,input:{planning_calendar:this.calendar,action_catalog:catalog,test_mode:true}}};
      try{await this.getHass().callApi('POST',endpoint,config);}catch(error){const read=await this.getHass().callApi('GET',endpoint);if(stableJson(read)!==stableJson(config))throw error;}
    }
    for(let attempt=0;attempt<8;attempt++) {
      const states=await this.getHass().callWS({type:'get_states'}), state=states.find(s=>s.entity_id.startsWith('automation.') && s.attributes?.id===id);
      if(state){this.automation=state.entity_id;this._createdState=state;const snapshot={ready:true,config,records:actionCatalog(config,this.calendar),fingerprint:stableJson(config),test_mode:config.use_blueprint.input.test_mode!==false};await this.publish(snapshot);return snapshot;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('L’automatisation est enregistrée. Actualisez la carte lorsque Home Assistant a terminé son chargement.');
  }
}
