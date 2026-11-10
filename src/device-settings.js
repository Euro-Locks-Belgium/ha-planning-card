import {ACTION_TYPES,ACTION_BLUEPRINT_VERSION,validateActionRecord,simpleActionRecord,targetEntity,mutationIssue} from './actions-model.js';
import {esc,dayOf,shiftDay} from './model.js';
import {stableJson} from './devices.js';
export const PlanningDeviceSettings={
  _deviceSettingsHtml(){
    const admin=this._config.demo || this._hass.user?.is_admin===true;
    const allowed=this._allowedDeviceTypes().length>0;
    return `<h3>Appareils du planning</h3><p class="hint">Ajoutez ici vos appareils une fois. Ils seront ensuite proposés dans chaque programmation.</p>${this._snapshot.records.length?`<div class="device-list">${this._snapshot.records.map(r=>`<div class="device-item"><div><strong translate="no">${esc(r.name)}</strong><small>${esc(this._t(ACTION_TYPES[r.type]?.label || r.type))} · <span>${r.enabled===false?'Désactivé':'Disponible'}</span></small></div>${admin?this._button('Modifier','edit-device',`data-device-id="${r.id}"`):''}</div>`).join('')}</div>`:'<p>Aucun appareil enregistré pour le moment.</p>'}${admin?this._button('+ Ajouter un appareil','new-device',`class="primary" ${allowed?'':'disabled'}`):'<p class="hint">Un administrateur ajoute les nouveaux appareils. Vous pouvez modifier les horaires et les actions des appareils disponibles.</p>'}${admin && !allowed?'<p class="hint">Sélectionnez d’abord les appareils autorisés dans les paramètres de la carte.</p>':''}`;
  },
  _allowedDeviceTypes(){const entities=this._config.entities || [];return Object.keys(ACTION_TYPES).filter(type=>type==='frech'?['switch','script','binary_sensor'].every(domain=>entities.some(e=>e.startsWith(domain+'.'))):entities.some(e=>e.startsWith(type+'.')));},
  _entityOptions(domain,value=''){
    const allowed=this._config.entities || [],list=Object.values(this._hass.states || {}).filter(s=>allowed.includes(s.entity_id) && s.entity_id.startsWith(domain+'.')).sort((a,b)=>(a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id,this._locale));
    const old=this._deviceSnapshot?.records.find(r=>r.id===this._deviceDraft?.id),preserve=old && [old.entity_id,old.switch_entity,old.input_entity,old.script_entity].includes(value);
    return `<option value="">${this._t(list.length?'Choisir une entité':'Aucune entité autorisée pour ce type.')}</option>${list.map(s=>`<option translate="no" value="${s.entity_id}" ${s.entity_id===value?'selected':''}>${esc(s.attributes?.friendly_name || s.entity_id)} — ${s.entity_id}</option>`).join('')}${value && preserve && !list.some(s=>s.entity_id===value)?`<option translate="no" selected disabled value="${esc(value)}">${esc(value)} (${this._t('hors sélection de la carte')})</option>`:''}`;
  },
  _deviceFormHtml(){
    const d=this._deviceDraft;
    const types=new Set([...this._allowedDeviceTypes(),...(d.id?[d.type]:[])]);
    const entity=(label,field,domain)=>`<label class="field">${label}<select data-device-field="${field}">${this._entityOptions(domain,d[field])}</select></label>`;
    return `<form data-device-form><div class="toolbar"><h2 tabindex="-1">${d.id?'Modifier un appareil':'Ajouter un appareil'}</h2>${this._button('Fermer','device-cancel')}</div><label class="field">Nom affiché<input data-device-field="name" maxlength="120" value="${esc(d.name)}" placeholder="Nom de l’appareil"></label><label class="field">Type<select data-device-field="type">${Object.entries(ACTION_TYPES).filter(([key])=>types.has(key)).map(([key,r])=>`<option value="${key}" ${d.type===key?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>${d.type==='frech'?`${entity('Relais de la Frech','switch_entity','switch')}${entity('Entrée de contrôle','input_entity','binary_sensor')}${entity('Script de démarrage existant','script_entity','script')}<label class="field">Numéro de la Frech<input type="number" min="1" max="21" step="1" data-device-field="frech_number" value="${d.frech_number || ''}"></label><p class="hint">Le script existant est conservé avec son relais, son entrée et son numéro. Le planning propose un démarrage seul.</p>`:entity('Appareil / entité','entity_id',d.type)}<label class="check field"><input type="checkbox" data-device-field="enabled" ${d.enabled?'checked':''}>Disponible dans les programmations</label><div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>Enregistrer l’appareil</button>${this._button('Annuler','device-cancel')}</div></form>`;
  },
  _openDevice(id=''){
    if(!this._config.demo && this._hass.user?.is_admin!==true)return;
    const record=this._snapshot.records.find(r=>r.id===id),types=this._allowedDeviceTypes();if(!record && !types.length){this._error='Sélectionnez d’abord les appareils autorisés dans les paramètres de la carte.';this._render();return;}this._deviceSnapshot=structuredClone(this._snapshot);this._deviceDraft=record?structuredClone(record):{name:'',type:types[0],entity_id:'',switch_entity:'',script_entity:'',input_entity:'',frech_number:1,enabled:true};this._error='';this._notice='';this._render();
  },
  _deviceChange(el){
    const d=this._deviceDraft;if(!d || !el.dataset.deviceField)return false;
    const field=el.dataset.deviceField;d[field]=el.type==='checkbox'?el.checked:field==='frech_number'?Number(el.value):el.value;
    if(field==='type'){if(d.type==='frech' && d.entity_id?.startsWith('switch.'))d.switch_entity=d.entity_id;this._render();}
    return true;
  },
  async _saveDevice(){
    if(this._busy || !this._deviceDraft)return;this._busy=true;this._error='';
    try{
      const d=this._deviceDraft,type=d.type,entity=type==='frech'?d.switch_entity:d.entity_id;
      const id=d.id || (type==='frech'?`frech_${(entity || '').replace('.','_')}`:simpleActionRecord(entity).id);
      const record={id,type,name:d.name.trim() || this._hass.states[entity]?.attributes?.friendly_name || entity,enabled:d.enabled,...(type==='frech'?{switch_entity:d.switch_entity,input_entity:d.input_entity,script_entity:d.script_entity,frech_number:Number(d.frech_number)}:{entity_id:entity})};
      const issue=validateActionRecord(record);if(issue)throw new Error(issue);
      const old=this._deviceSnapshot.records.find(r=>r.id===id);
      for(const field of type==='frech'?['switch_entity','input_entity','script_entity']:['entity_id'])if(!this._config.entities.includes(record[field]) && (!d.id || old?.[field]!==record[field]))throw new Error('Cette entité n’est pas autorisée dans les paramètres de la carte.');
      if(!d.id && this._deviceSnapshot.records.some(r=>r.id===id || targetEntity(r)===entity))throw new Error('Cet appareil est déjà présent. Utilisez Modifier dans la liste.');
      if(old && stableJson({...old,name:''})!==stableJson({...record,name:''})){const today=dayOf(Date.now(),this._zone),events=this._config.demo?this._events:await this._fetch(shiftDay(today,-1),shiftDay(today,2));for(const event of events){if([...event.meta?.start_actions || [],...event.meta?.end_actions || []].some(a=>a.target===id)){const active=mutationIssue(event,'occurrence',events);if(active)throw new Error(active);}}}
      if(this._config.demo){const records=this._snapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot={...this._snapshot,records};}
      else{if(!this._snapshot.ready){this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);this._deviceSnapshot=this._snapshot;}const records=this._deviceSnapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot=await this._store.save(this._deviceSnapshot,records);}
      this._deviceDraft=null;this._settings=true;this._notice='Appareil enregistré.';if(this._config.entities?.length && !this._config.entities.includes(entity))this._notice+=' Pour le proposer sur cette carte, cochez-le dans Modifier la carte → Appareils.';else this._notice+=' Il est disponible dans les programmations.';
    }catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  },
};
export const DEVICE_SETTINGS_STYLE=`.device-list{display:grid;gap:8px;margin:14px 0}.device-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--divider-color,#41474e);border-radius:8px}.device-item small{display:block;margin-top:5px}.device-item strong{overflow-wrap:anywhere}`;
