import {esc,dayOf,shiftDay,weekday,toInstant,localMinute,viewRange,eventColor,colorText,newEventId} from './model.js';
import {visibleWeekdays} from './views.js';
import {ACTION_TYPES,ACTION_BLUEPRINT_VERSION,normalizePlanningConfig,normalizeSchedule,simpleActionRecord,targetEntity,operationsFor,defaultOperation,oppositeOperation,recurring,occurrenceSelector,schedulePayload,calendarEditPayload,seriesRule,ruleDays,editedWeeklyRule,occurrenceDeletePayload,shiftedOccurrence,mutationIssue,validateSchedule,weeklyStart,scheduleFingerprint,packWeekEvents} from './actions-model.js';
import {PlanningActionStore,actionRegistry} from './action-store.js';
import {PlanningSeriesStore,seriesOwner,annotateSeries} from './series-store.js';
import {expandDemoCalendar} from './series-demo.js';
import {PLANNING_STYLE} from './planning-style.js';
import {PlanningInteractions,INTERACTION_STYLE} from './interactions.js';
import {PlanningDeviceSettings,DEVICE_SETTINGS_STYLE} from './device-settings.js';
import {planningLanguage,PLANNING_LOCALES,planningTranslate,localizePlanningRoot} from './i18n.js';

class PlanningCard extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._events=[];this._demoRows=[];this._snapshot={records:[],ready:false,test_mode:true};this._generation=0;
    this.shadowRoot.addEventListener('click',e=>this._click(e));
    this.shadowRoot.addEventListener('change',e=>this._change(e));
    this.shadowRoot.addEventListener('input',e=>{if(this._deviceChange(e.target))return;if(e.target.name && this._draft)this._draft[e.target.name]=e.target.value;});
    this.shadowRoot.addEventListener('submit',e=>{e.preventDefault();if(e.target.hasAttribute('data-device-form'))this._saveDevice();else this._save();});
    this._installInteractions();
  }
  static getConfigElement(){return document.createElement('ha-planning-card-editor');}
  static getStubConfig(){return {type:'custom:ha-planning-card',title:'Planning',demo:true};}
  getCardSize(){return 8;}
  getGridOptions(){return {columns:24,min_columns:6,rows:9,min_rows:6};}
  setConfig(config){this._config=normalizePlanningConfig(config);this._generation++;this._initialized=false;this._init();}
  set hass(value){const language=this._language;this._hass=value;const initialized=this._initialized;this._init();if(initialized && language!==this._language)this._render();}
  get _language(){return planningLanguage(this._config?.language || 'auto',this._hass);}
  get _locale(){return PLANNING_LOCALES[this._language];}
  _t(value){return planningTranslate(this._language,value);}
  _weekday(day){return new Intl.DateTimeFormat(this._locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,10,1+day))).replace(/\.$/,'');}
  connectedCallback(){if(!this._timer)this._timer=setInterval(()=>{if(this.isConnected && !this._draft && !this._settings && !this._busy && !this._pointer?.active)this._load();},60000);this._init();}
  disconnectedCallback(){clearInterval(this._timer);clearTimeout(this._toastTimer);this._timer=null;this._clearPointer();}
  _init(){
    if(!this._config || !this._hass || this._initialized)return;
    this._clearPointer();this._deviceDraft=null;
    this._initialized=true;this._zone=this._hass.config?.time_zone || 'Europe/Brussels';this._selected=dayOf(Date.now(),this._zone);this._month=this._selected.slice(0,7);this._view=this._config.appearance.default_view;this._draft=null;this._settings=false;this._events=[];this._error='';this._loaded=!!this._config.demo;this._loading=false;this._snapshot={records:[],ready:false,test_mode:true};
    this._store=new PlanningActionStore(()=>this._hass,this._config.calendar,this._config.execution_automation);
    this._seriesRecords=[];this._seriesStore=new PlanningSeriesStore(()=>this._config.demo?{callApi:async(method,path)=>{const q=new URLSearchParams(path.split('?')[1]);return expandDemoCalendar(this._demoRows,q.get('start'),q.get('end'),this._zone);},callWS:async payload=>{this._demoWrite(payload);return null;}}:this._hass,this._config.calendar || 'calendar.demo',this._zone);
    this._render();this._load();
  }
  get _weekHourHeight(){return this._config.appearance.density==='compact'?40:44;}
  _range(){return viewRange(this._month,this._config.appearance.first_day);}
  _meta(event){
    if(event.meta)return event.meta;
    const old=event.legacy;
    if(!old || !['weekly','restart'].includes(old.kind) || !old.devices?.length)return null;
    const records=old.devices.map(id=>this._record(id));if(records.some(r=>!r))return null;
    return {planning:2,kind:'schedule',id:old.id || newEventId(),color:old.color,has_end:false,start_actions:records.map(r=>({target:r.id,op:defaultOperation(r)})),end_actions:[],note:old.note || ''};
  }
  _time(value){return new Intl.DateTimeFormat(this._locale,{timeZone:this._zone,hour:'2-digit',minute:'2-digit',hour12:this._config.appearance.time_format==='12'}).format(new Date(value));}
  _label(day){return new Intl.DateTimeFormat(this._locale,{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(new Date(`${day}T12:00Z`));}
  _record(id){if(id?.startsWith('entity:')){const entity=id.slice(7);return simpleActionRecord(entity,this._hass.states[entity]?.attributes?.friendly_name);}return this._snapshot.records.find(r=>r.id===id);}
  _choices(){
    const selected=this._config.entities || [],current=new Set([...(this._draft?.start_actions || []),...(this._draft?.end_actions || [])].map(a=>a.target));
    const records=this._snapshot.records.filter(r=>r.enabled!==false && (selected.includes(targetEntity(r)) || current.has(r.id))).map(r=>({...r,value:r.id}));
    if(this._config.demo || this._hass.user?.is_admin)for(const [entity,state] of Object.entries(this._hass.states || {})){
      if(!ACTION_TYPES[entity.split('.')[0]] || !selected.includes(entity) || this._snapshot.records.some(r=>targetEntity(r)===entity || (r.type==='frech' && r.script_entity===entity)))continue;
      try{records.push({...simpleActionRecord(entity,state.attributes?.friendly_name),value:`entity:${entity}`});}catch{/* Unsupported entities remain outside the action picker. */}
    }
    return records.sort((a,b)=>a.name.localeCompare(b.name,this._locale));
  }
  async _fetch(start,end){
    const state=this._hass.states[this._config.calendar];
    if(!state || !['on','off'].includes(state.state))throw new Error('Choisissez un calendrier local disponible dans la configuration de la carte.');
    if((Number(state.attributes.supported_features)&7)!==7)throw new Error('Ce calendrier ne permet pas toutes les modifications. Utilisez Calendrier local.');
    const query=new URLSearchParams({start:toInstant(`${start}T00:00`,this._zone),end:toInstant(`${end}T00:00`,this._zone)});
    const rows=await this._hass.callApi('GET',`calendars/${this._config.calendar}?${query}`);
    if(!Array.isArray(rows))throw new Error('Réponse calendrier invalide.');
    return rows.filter(r=>!actionRegistry(r) && !r.description?.includes('"planning_devices"') && !r.description?.includes('"planning_series_journal"') && !r.description?.includes('"planning_series_pending"')).map(r=>normalizeSchedule(r,this._config.calendar,this._zone));
  }
  async _load(){
    if(!this._initialized || this._loading)return;
    if(!this._config.calendar && !this._config.demo)return;
    const generation=this._generation;this._loading=true;
    try{this._seriesRecords=await this._seriesStore.records();for(const record of this._seriesRecords)if(record.pending)await this._seriesStore.recover(record);this._seriesRecords=await this._seriesStore.records();if(this._config.demo){this._expandDemo();this._loaded=true;return;}const range=this._range();const [events,snapshot]=await Promise.all([this._fetch(range.queryStart,range.queryEnd),this._store.load()]);if(generation!==this._generation)return;if(snapshot.ready && snapshot.config && snapshot.needsPublish){try{await this._store.publish(snapshot);snapshot.needsPublish=false;}catch(e){snapshot.publishError=e.message;}}this._events=annotateSeries(events,this._seriesRecords);this._snapshot=snapshot;this._loaded=true;this._error=snapshot.publishError || '';}
    catch(e){if(generation===this._generation){this._error=e.message;this._loaded=false;}}
    finally{if(generation===this._generation){this._loading=false;this._render();}}
  }
  _expandDemo(){
    const range=this._range(),rows=expandDemoCalendar(this._demoRows,toInstant(`${range.queryStart}T00:00`,this._zone),toInstant(`${range.queryEnd}T00:00`,this._zone),this._zone);
    this._events=annotateSeries(rows.filter(r=>!r.description?.includes('"planning_series_journal"')&&!r.description?.includes('"planning_series_pending"')).map(row=>normalizeSchedule(row,this._config.calendar || 'calendar.demo',this._zone)),this._seriesRecords || []);
  }
  _button(label,action,extra=''){return `<button type="button" data-action="${action}" ${this._busy?'disabled':''} ${extra}>${label}</button>`;}
  _executionLabel(){if(this._config.demo)return 'Essai local · aucune commande envoyée';if(!this._snapshot.ready)return 'Choisissez vos horaires, puis préparez l’exécution dans Réglages.';if(!this._snapshot.config)return 'Programmations partagées · exécution gérée par Home Assistant';if(this._hass.states[this._store.automation]?.state==='off')return 'Automatisation désactivée dans Home Assistant';return this._snapshot.test_mode?'Mode test · notifications uniquement':'Exécution Home Assistant active';}
  _eventHtml(e,style=''){
    const meta=this._meta(e),owned=!!(e.meta || e.legacy),names=meta?.start_actions.map(a=>this._record(a.target)?.name || a.target).join(', ') || '';
    const past=dayOf(e.start,this._zone)<dayOf(Date.now(),this._zone) && !(meta?.has_end && Date.parse(e.start)<=Date.now() && Date.now()<Date.parse(e.end)),baseColor=eventColor(meta?.color || e.legacy?.color),color=past?'#'+baseColor.slice(1).match(/../g).map(value=>Math.round(parseInt(value,16)*.8).toString(16).padStart(2,'0')).join(''):baseColor;
    return `<div class="event ${owned?'':'external'} ${past?'is-past-event':''}" data-event="${esc(e.key)}" draggable="${!!e.uid && !this._busy}" style="--event:${color};--event-text:${colorText(color)};${style}"><button type="button" class="event-main" translate="no" data-event="${esc(e.key)}" title="${esc(`${e.summary} · ${this._time(e.start)} · ${this._t('Cliquer pour modifier')}`)}"><span>${this._time(e.start)}${meta?.has_end?' → '+this._time(e.end):''}${recurring(e)?' ↻':''}</span><strong translate="no">${esc(e.summary)}</strong>${this._config.appearance.show_device_names && names?`<small>${esc(names)}</small>`:''}</button>${e.uid?`<button type="button" class="event-handle" data-move-handle="${esc(e.key)}" title="Glisser pour déplacer ce jour" aria-label="${this._t('Déplacer')} ${esc(e.summary)}">⠿</button>`:''}</div>`;
  }
  _dayEvents(day){return this._events.filter(e=>dayOf(e.start,this._zone)===day && e.role!=='legacy-closure').sort((a,b)=>a.start.localeCompare(b.start));}
  _calendarHtml(){
    const a=this._config.appearance,days=visibleWeekdays(a.first_day,a.show_weekends),range=this._range(),today=dayOf(Date.now(),this._zone);
    if(this._view==='agenda')return `<div class="agenda">${this._events.filter(e=>e.role!=='legacy-closure' && dayOf(e.start,this._zone).startsWith(this._month)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>`<div class="agenda-item ${dayOf(e.start,this._zone)<today?'is-past':''}"><small>${this._label(dayOf(e.start,this._zone))}</small>${this._eventHtml(e)}</div>`).join('') || '<div class="empty">Aucune programmation ce mois-ci.</div>'}</div>`;
    if(this._view==='week'){
      const first=shiftDay(this._selected,-((weekday(this._selected)-a.first_day+7)%7)),week=Array.from({length:7},(_,i)=>shiftDay(first,i)).filter(d=>days.includes(weekday(d)));
      return `<div class="week-scroll"><div class="week" style="--columns:${days.length};--planning-hour-height:${this._weekHourHeight}px"><div class="week-head"></div>${week.map(d=>`<div class="week-head ${d<today?'is-past':''}">${this._label(d)}</div>`).join('')}<div class="hours">${Array.from({length:24},(_,i)=>`<span style="top:${i*this._weekHourHeight}px">${String(i).padStart(2,'0')}:00</span>`).join('')}</div>${week.map(d=>`<div class="week-day ${d<today?'is-past':''}" data-drop="${d}" aria-label="${this._label(d)}">${packWeekEvents(this._dayEvents(d),this._zone,this._weekHourHeight).map(p=>this._eventHtml(p.event,`top:${p.minute/60*this._weekHourHeight}px;height:${(p.visualEnd-p.minute)/60*this._weekHourHeight}px;left:${p.lane/p.lanes*100}%;width:${100/p.lanes}%`)).join('')}</div>`).join('')}</div></div>`;
    }
    let html=days.map(d=>`<div class="weekday">${this._weekday(d)}</div>`).join('');
    for(let i=0;i<range.count;i++){const day=shiftDay(range.start,i);if(!days.includes(weekday(day)))continue;html+=`<div class="day ${day.startsWith(this._month)?'':'outside'} ${day===this._selected?'selected':''} ${day<today?'is-past':''}" data-drop="${day}"><button class="date" type="button" data-day="${day}" aria-label="${this._t('Ajouter le')} ${esc(this._label(day))}">${Number(day.slice(8))}</button>${this._dayEvents(day).map(e=>this._eventHtml(e)).join('')}</div>`;}
    return `<div class="calendar" style="--columns:${days.length};--weeks:${range.count/7}">${html}</div>`;
  }
  _timeSelect(prefix,value){const [h,m]=value.split(':');return `<div class="time"><select name="${prefix}_hour" aria-label="Heure ${prefix==='start'?'de début':'de fin'}">${Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(x=>`<option ${x===h?'selected':''}>${x}</option>`).join('')}</select><span>:</span><select name="${prefix}_minute" aria-label="Minute ${prefix==='start'?'de début':'de fin'}">${[...new Set(['00','10','20','30','40','50',m])].sort().map(x=>`<option ${x===m?'selected':''}>${x}</option>`).join('')}</select></div>`;}
  _actionsHtml(phase){
    const choices=this._choices(),list=this._draft[phase];
    return list.map((row,index)=>{const record=this._record(row.target),ops=operationsFor(record);return `<div class="action-row" data-phase="${phase}" data-index="${index}"><select data-target aria-label="Appareil ${phase==='start_actions'?'au début':'à la fin'} ${index+1}"><option value="">Choisir un appareil ou un script</option>${choices.map(r=>`<option translate="no" value="${esc(r.value)}" ${r.value===row.target?'selected':''}>${esc(r.name)}</option>`).join('')}${row.target && !choices.some(r=>r.value===row.target)?`<option translate="no" selected value="${esc(row.target)}">${esc(row.target)} (${this._t('indisponible')})</option>`:''}</select><select data-operation aria-label="Action ${index+1}">${Object.entries(ops).map(([value,label])=>`<option value="${value}" ${row.op===value?'selected':''}>${label}</option>`).join('')}</select><button type="button" data-remove-action aria-label="Retirer l’action ${index+1}">×</button></div>`;}).join('');
  }
  _scopeHtml(d){return `<label class="field">Modifier<select name="scope" aria-label="Portée de la modification"><option value="occurrence" ${d.scope==='occurrence'?'selected':''}>Ce jour uniquement</option><option value="series" ${d.scope==='series'?'selected':''}>Toute la série</option></select></label>${d.scope==='series'?`<p class="status notice">La série sera modifiée à partir de la date choisie. Les jours déjà déplacés ou supprimés sont conservés.</p>${d.seriesSnapshot && !d.seriesSnapshot.complete?'<p class="status notice">Ancienne série : importez une fois le fichier ICS du calendrier pour reprendre aussi les jours déjà supprimés.</p><label class="field">Importer les exceptions existantes<input type="file" name="series_import" accept=".ics,text/calendar"></label>':''}${d.seriesError?`<p class="status error">${esc(d.seriesError.message)}</p>`:''}`:'<p class="status notice">Seul ce jour sera modifié. Les autres occurrences gardent leur horaire et leurs actions.</p>'}`;}
  _formHtml(){
    const d=this._draft,existing=!!d.uid,isRecurring=recurring(d);
    if(d.calendarOnly)return this._calendarOnlyFormHtml();
    if(d.readonly)return `<section class="panel"><h2 translate="no">${esc(d.summary)}</h2><p>Ce calendrier ne fournit pas d’identifiant modifiable pour cet événement. Utilisez un calendrier local permettant sa modification.</p>${this._button('Fermer','cancel')}</section>`;
    return `<form><div class="toolbar"><h2>${existing?'Modifier cette programmation':'Nouvelle programmation'}</h2>${this._button('Fermer','cancel')}</div>${existing && isRecurring?this._scopeHtml(d):''}<label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}" placeholder="Ex. Chauffe atelier ou ouverture barrière"></label><div class="grid2"><label>${existing && d.scope==='series'?'Date de début de la série':existing?'Date de cette occurrence':'Date de début'}<input required type="date" name="date" value="${d.date}"></label>${!existing?`<label>Répétition<select name="repeat"><option value="once" ${d.repeat==='once'?'selected':''}>Une seule fois</option><option value="weekly" ${d.repeat==='weekly'?'selected':''}>Chaque semaine</option></select></label>`:'<p class="hint">Pour déplacer, changez la date ou l’heure. Vous pouvez aussi glisser la programmation sur le calendrier.</p>'}</div>${((!existing && d.repeat==='weekly') || (existing && d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)))?`<div class="field"><label>Jours habituels</label><div class="weekdays">${[1,2,3,4,5,6,0].map(i=>`<label class="check"><input type="checkbox" data-weekday="${i}" ${d.days.includes(i)?'checked':''}>${this._weekday(i)}</label>`).join('')}</div><p class="hint">Créez autant de programmations que nécessaire pour des horaires différents.</p></div>`:''}<h3>Au début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}${this._actionsHtml('start_actions')}${this._button('+ Ajouter une action','add-start')}<label class="check field"><input name="has_end" type="checkbox" ${d.has_end?'checked':''}>Prévoir une heure et des actions de fin</label>${d.has_end?`<h3>À la fin</h3>${this._timeSelect('end',`${d.end_hour}:${d.end_minute}`)}<p class="hint">Si l’heure de fin précède l’heure de début, le créneau se termine le lendemain.</p>${this._actionsHtml('end_actions')}${this._button('+ Ajouter une action à la fin','add-end')}`:'<p class="hint">Action ponctuelle : adapté au démarrage des Frech, sans arrêt programmé.</p>'}<div class="grid2 field"><label>Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label><label>Note facultative<textarea name="note" rows="2">${esc(d.note)}</textarea></label></div>${!this._config.demo && !this._snapshot.ready?'<p class="status">Le premier enregistrement préparera l’exécution du calendrier en mode test. Un administrateur est nécessaire.</p>':''}<div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>${this._busy?'Enregistrement…':d.scope==='series'?'Enregistrer la série':'Enregistrer'}</button>${this._button('Annuler','cancel')}${existing?this._button(isRecurring?'Supprimer ce jour':'Supprimer','delete','class="danger"'):''}</div>${existing && isRecurring?`<details><summary>Toute la série</summary><p class="hint">La suppression de série retire toutes ses occurrences, y compris les jours déplacés.</p>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toutes les occurrences de cette série ?':'Supprimer uniquement cette occurrence ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _calendarOnlyFormHtml(){
    const d=this._draft;
    return `<form><div class="toolbar"><h2>Modifier cette programmation</h2>${this._button('Fermer','cancel')}</div><p class="status notice">L’horaire peut être modifié sans changer les actions existantes.</p>${recurring(d)?this._scopeHtml(d):''}<label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}"></label><label class="field">${d.scope==='series'?'Date de début de la série':'Date de cette occurrence'}<input type="date" required name="date" value="${d.date}"></label>${d.legacy?`<label class="field">Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label>`:''}<h3>Heure de début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}<p class="hint">La durée de l’événement et ses associations existantes sont conservées.</p><label class="field">${d.legacy?'Note':'Description'}<textarea name="note" rows="3">${esc(d.note)}</textarea></label><div class="buttons"><button type="submit" class="primary" ${this._busy?'disabled':''}>${d.scope==='series'?'Enregistrer la série':'Enregistrer'}</button>${this._button('Annuler','cancel')}${this._button(recurring(d)?'Supprimer ce jour':'Supprimer','delete','class="danger"')}</div><details><summary>Actions et appareils</summary><p>Pour associer des appareils à cette programmation et utiliser les actions de début/fin de Planning :</p>${this._button('Configurer les actions','configure-actions')}</details>${recurring(d)?`<details><summary>Toute la série</summary>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toute la série ?':'Supprimer uniquement ce jour ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _settingsHtml(){return `<section class="panel"><div class="toolbar"><h2>Réglages du planning</h2>${this._button('Fermer','settings')}</div><p class="status">${esc(this._executionLabel())}</p>${!this._config.demo && !this._snapshot.ready?this._button('Préparer l’exécution en mode test','setup','class="primary"'):''}${this._deviceSettingsHtml()}<p class="hint">Pour choisir les appareils affichés sur cette carte : Modifier la carte → Appareils proposés dans les programmations. Pour les couleurs et la vue initiale : Personnalisation.</p></section>`;}
  _render(){
    if(!this._initialized)return;
    const dialogState=this._rememberDialog();
    const a=this._config.appearance,title=new Intl.DateTimeFormat(this._locale,{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(`${this._month}-01T12:00Z`));
    this.shadowRoot.innerHTML=`<style>${PLANNING_STYLE}${INTERACTION_STYLE}${DEVICE_SETTINGS_STYLE}</style><ha-card><main data-density="${a.density}" data-event-style="${a.event_style}" ${a.accent_color?`style="--accent:${a.accent_color}"`:''}><header class="card-heading"><div class="card-title"><h1 translate="no">${esc(this._config.title)}</h1><span class="mode-pill" title="${esc(this._t(this._executionLabel()))}">${this._config.demo?'Local':!this._snapshot.ready?'À configurer':!this._snapshot.config?'Partagé':this._hass.states[this._store.automation]?.state==='off'?'Arrêté':this._snapshot.test_mode?'Test':'Actif'}</span></div><div class="heading-actions">${this._button('<span aria-hidden="true">+</span> <span class="add-label">Programmation</span>','new','class="primary" aria-label="+ Programmation" title="Nouvelle programmation" '+(!this._config.demo && !this._loaded?'disabled':''))}${this._button('<span aria-hidden="true">⚙</span> <span class="settings-label">Réglages</span>','settings','aria-label="⚙ Réglages" title="Réglages"')}</div></header>${this._error?`<div role="alert" class="status error">${esc(this._error)}</div>`:''}${this._notice?`<div role="status" class="status notice">${esc(this._notice)}</div>`:''}<nav class="calendar-toolbar" aria-label="Vue du calendrier"><div class="period-controls">${this._button('‹','previous','aria-label="Période précédente"')}<h2>${esc(title)}</h2>${this._button('›','next','aria-label="Période suivante"')}</div><div class="view-controls">${Object.entries({month:'Mois',week:'Semaine',agenda:'Agenda'}).map(([id,label])=>this._button(label,`view-${id}`,`aria-pressed="${id===this._view}"`)).join('')}${this._button('<span class="today-text">Aujourd’hui</span><span class="today-icon" aria-hidden="true">◎</span>','today','class="today-button" aria-label="Aujourd’hui" title="Aujourd’hui"')}${this._button('↻','refresh','class="refresh-button" aria-label="Actualiser"')}</div></nav>${this._calendarHtml()}<p class="hint">Cliquez pour modifier. Glissez ⠿ pour déplacer un seul jour.</p>${this._settings?this._settingsHtml():''}${this._draft?this._formHtml():''}</main></ha-card>`;
    const main=this.shadowRoot.querySelector('main'),panel=main.querySelector(':scope > form,:scope > .panel');
    if(this._draft || this._settings || this._deviceDraft){
      const dialog=document.createElement('dialog');dialog.className='planning-dialog';if(a.accent_color)dialog.style.setProperty('--accent',a.accent_color);dialog.setAttribute('aria-label',this._deviceDraft?'Appareil du planning':this._draft?'Programmation':'Réglages du planning');
      const body=document.createElement('div');body.className='dialog-body';
      if(this._deviceDraft){panel?.remove();body.innerHTML=this._deviceFormHtml();}else if(panel)body.append(panel);
      const feedback=main.querySelector('[role=alert]') || main.querySelector('[role=status]');if(feedback)body.prepend(feedback);
      body.querySelectorAll('h2').forEach(h=>h.tabIndex=-1);dialog.append(body);this.shadowRoot.append(dialog);
    }else if(this._error || this._notice){
      main.querySelector('[role=alert]')?.remove();main.querySelector('[role=status]')?.remove();
      const toast=document.createElement('div');toast.className='planning-toast'+(this._error?' error':'');toast.setAttribute('popover','manual');toast.setAttribute('role',this._error?'alert':'status');toast.innerHTML=esc(this._error || this._notice)+this._button('×','dismiss-toast','aria-label="Fermer le message"');this.shadowRoot.append(toast);
    }
    localizePlanningRoot(this.shadowRoot,this._language);
    this._restoreDialog(dialogState);
  }
  _open(event,date=this._selected){
    this._error='';this._notice='';this._settings=false;this._deviceDraft=null;
    const start=event?localMinute(event.start,this._zone):`${date}T06:00`,end=event?localMinute(event.end,this._zone):`${date}T07:00`,m=event?this._meta(event):null;
    this._draft={...(event || {}),original:event?{...event}:null,actionSnapshot:structuredClone(this._snapshot),readonly:!!event && !m,calendar:this._config.calendar || 'calendar.demo',event_id:m?.id || newEventId(),summary:event?.summary || '',date:start.slice(0,10),start_hour:start.slice(11,13),start_minute:start.slice(14,16),end_hour:end.slice(11,13),end_minute:end.slice(14,16),repeat:event?.rrule?'weekly':'once',days:[weekday(date)],has_end:m?.has_end || false,start_actions:m?structuredClone(m.start_actions):[{target:'',op:''}],end_actions:m?structuredClone(m.end_actions):[],color:m?.color || '#3689e6',note:m?.note || '',scope:'occurrence'};
    if(event){this._draft.seriesRule=seriesRule(event,this._events);this._draft.days=ruleDays(this._draft.seriesRule,weekday(start.slice(0,10)));this._draft.color=event.meta?.color || event.legacy?.color || '#3689e6';}
    this._draft.readonly=!!event && !event.uid;
    this._draft.calendarOnly=!!event?.uid && !event.meta;
    if(this._draft.calendarOnly)this._draft.note=event.legacy?.note || (event.legacy?'':event.description || '');
    this._render();
  }
  _change(event){
    const el=event.target;if(this._deviceChange(el))return;const d=this._draft;if(!d)return;
    if(el.name==='series_import'){this._importSeries(el.files?.[0],d);return;}
    const rowEl=el.closest('.action-row');
    if(rowEl){const row=d[rowEl.dataset.phase][Number(rowEl.dataset.index)];if(el.hasAttribute('data-target')){row.target=el.value;row.op=defaultOperation(this._record(row.target));this._render();}else if(el.hasAttribute('data-operation'))row.op=el.value;return;}
    if(el.dataset.weekday!==undefined){d.days=Array.from(this.shadowRoot.querySelectorAll('[data-weekday]:checked'),e=>Number(e.dataset.weekday));return;}
    if(!el.name)return;d[el.name]=el.type==='checkbox'?el.checked:el.value;
    if(el.name==='date' && !d.uid && d.repeat==='once' && /^\d{4}-\d{2}-\d{2}$/.test(d.date))d.days=[weekday(d.date)];
    if(el.name==='has_end' && d.has_end && !d.end_actions.length)d.end_actions=d.start_actions.filter(a=>a.target && oppositeOperation(a.op) && Object.hasOwn(operationsFor(this._record(a.target)),oppositeOperation(a.op))).map(a=>({target:a.target,op:oppositeOperation(a.op)}));
    if(el.name==='scope' && d.scope==='series')this._captureSeries(d);
    if(['repeat','has_end','scope'].includes(el.name))this._render();
  }
  _captureSeries(d){
    if(d.seriesSnapshot)return Promise.resolve(d.seriesSnapshot);
    if(d.seriesPending)return d.seriesPending;
    d.seriesPending=(async()=>{
      try{
        const snapshot=await this._seriesStore.read(d.original,this._events),row=this._config.demo?this._demoRows.find(row=>row.uid===snapshot.master_uid):null;
        if(row && !snapshot.complete){snapshot.complete=true;snapshot.model={dtstart:row.start,dtend:row.end,summary:row.summary,description:row.description,rrule:row.rrule};for(const rid of row.deleted || [])snapshot.exceptions[`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`]={deleted:true};for(const [rid,item] of Object.entries(row.exceptions || {}))snapshot.exceptions[`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`]={event:{dtstart:item.start,dtend:item.end,summary:item.summary,description:item.description},uid:row.uid,native:true,recurrence_id:rid};}
        d.seriesSnapshot=snapshot;d.series_revision=snapshot._raw || snapshot.id;
        if(!d.seriesRule){d.seriesRule=snapshot.model.rrule;d.days=ruleDays(d.seriesRule,weekday(d.date));}
        return snapshot;
      }catch(error){d.seriesError=error;return null;}
      finally{if(this._draft===d && d.scope==='series' && !this._busy)this._render();}
    })();return d.seriesPending;
  }
  async _importSeries(file,d){if(!file)return;try{const snapshot=await this._captureSeries(d);if(!snapshot)throw d.seriesError;d.seriesSnapshot=this._seriesStore.import(snapshot,await file.text());d.seriesRule=d.seriesSnapshot.model.rrule;d.days=ruleDays(d.seriesRule,weekday(d.date));d.seriesError=null;if(this._draft===d)this._error='';}catch(error){d.seriesError=error;}if(this._draft===d)this._render();}
  _draftDates(d){
    const time=`${d.start_hour}:${d.start_minute}`;
    if(d.calendarOnly){const first=d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)?dayOf(weeklyStart(d.date,time,d.days,this._zone,Date.now(),true),this._zone):d.date;return shiftedOccurrence(d.original,first,Number(d.start_hour)*60+Number(d.start_minute),this._zone);}
    const start=((!d.uid && d.repeat==='weekly') || (d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)))?weeklyStart(d.date,time,d.days,this._zone,Date.now(),this._config.demo || d.scope==='series'):toInstant(`${d.date}T${time}`,this._zone);
    let end=new Date(Date.parse(start)+60000).toISOString();
    if(d.has_end){let day=dayOf(start,this._zone),endTime=`${d.end_hour}:${d.end_minute}`;if(endTime<=time)day=shiftDay(day,1);end=toInstant(`${day}T${endTime}`,this._zone);}
    return {start,end};
  }
  async _freshFor(event,target,scope='occurrence'){
    const from=[dayOf(event.start,this._zone),target?dayOf(target.start,this._zone):'9999-12-31'].sort()[0],to=[dayOf(event.end,this._zone),target?dayOf(target.end,this._zone):'0000-01-01'].sort().at(-1);
    const rows=await this._fetch(shiftDay(from,-1),shiftDay(to,2)),same=rows.find(x=>x.uid===event.uid && (x.recurrence_id || '')===(event.recurrence_id || ''));
    if(!same || scheduleFingerprint(same)!==scheduleFingerprint(event))throw new Error('Cette occurrence a changé ou a été supprimée. Actualisez avant de recommencer.');
    if(scope==='series'){const today=dayOf(Date.now(),this._zone);rows.push(...await this._fetch(shiftDay(today,-1),shiftDay(today,2)));}const issue=mutationIssue(same,scope,rows);if(issue)throw new Error(issue);return rows;
  }
  async _freshForIfLive(event,target,scope='occurrence'){const issue=mutationIssue(event,scope,this._events);if(issue)throw new Error(issue);occurrenceSelector(event,scope);if(!this._config.demo)await this._freshFor(event,target,scope);}
  _demoWrite(payload){
    const row=this._demoRows.find(x=>x.uid===payload.uid);
    if(payload.type.endsWith('/delete')){if(payload.recurrence_id){row.deleted=[...(row.deleted || []),payload.recurrence_id];if(row.exceptions)delete row.exceptions[payload.recurrence_id];}else this._demoRows=this._demoRows.filter(x=>x.uid!==payload.uid);return;}
    const saved={...payload.event,start:payload.event.dtstart,end:payload.event.dtend,uid:payload.uid || newEventId()};
    if(payload.recurrence_id){row.exceptions={...row.exceptions,[payload.recurrence_id]:{...saved,rrule:''}};}else if(row){if(saved.rrule && (saved.start!==row.start || saved.rrule!==row.rrule)){row.exceptions={};row.deleted=[];}Object.assign(row,saved);}else this._demoRows.push(saved);
  }
  async _write(payload,draft){
    if(payload.type==='planning-series-update')return this._seriesStore.update(this._draft.seriesSnapshot,payload.event);
    const original=draft?.original || this._draft?.original || this._events.find(e=>e.uid===payload.uid && (!payload.recurrence_id || e.recurrence_id===payload.recurrence_id));
    if(payload.type.endsWith('/delete') && this._draft?.deleteScope==='series' && original)return this._seriesStore.deleteSeries(original);
    if(original && recurring(original) && (payload.type.endsWith('/update') || payload.type.endsWith('/delete')))return this._seriesStore.occurrence(original,payload);
    if(this._config.demo){this._demoWrite(payload);return;}
    try{await this._hass.callWS(payload);}catch(error){
      if(!draft)throw error;
      const rows=await this._fetch(shiftDay(dayOf(draft.start,this._zone),-1),shiftDay(dayOf(draft.end,this._zone),2));
      const found=rows.filter(e=>(payload.uid?e.uid===payload.uid:e.meta?.id===draft.event_id) && e.start===draft.start && e.end===draft.end && e.summary===draft.summary.trim() && (e.description || '')===payload.event.description && (!payload.recurrence_id || e.recurrence_id===payload.recurrence_id) && (!payload.event.rrule || e.rrule===payload.event.rrule));
      if(found.length!==1)throw error;
    }
  }
  async _save(){
    if(this._busy || !this._draft)return;this._busy=true;this._error='';const d=this._draft;
    try{
      if(!this._config.demo && d.pendingCreate){const pending=d.pendingCreate,rows=await this._fetch(shiftDay(dayOf(pending.start,this._zone),-1),shiftDay(dayOf(pending.end,this._zone),2));const found=rows.filter(e=>e.meta?.id===d.event_id);if(found.length){if(!found.some(e=>e.start===pending.start && e.end===pending.end && e.description===pending.description))throw new Error('Une programmation avec cet identifiant existe déjà. Actualisez avant de recommencer.');this._draft=null;this._notice='La première sauvegarde est déjà enregistrée. Ouvrez la programmation pour la modifier.';await this._load();return;}}
      if(!d.summary.trim())throw new Error('Donnez un nom à la programmation.');
      if(d.scope==='series'){if(!await this._captureSeries(d))throw d.seriesError;if(!d.seriesSnapshot.complete)throw new Error('Importez une fois le fichier ICS pour conserver toutes les exceptions de cette ancienne série.');if(!d.seriesRule)throw new Error('Règle de répétition indisponible. Ouvrez une occurrence habituelle.');d.rrule=editedWeeklyRule(d.seriesRule,d.days);}
      Object.assign(d,this._draftDates(d));
      if(d.calendarOnly){if(!this._config.demo && Date.parse(d.start)<Date.now()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');await this._freshForIfLive(d.original,d,d.scope);const description=d.legacy?(d.note===(d.legacy.note || '') && eventColor(d.color)===eventColor(d.legacy.color)?d.original.description:JSON.stringify({...d.legacy,note:d.note,color:eventColor(d.color)})):d.note;await this._write(calendarEditPayload(d.original,{...d,description},d.scope),d);this._draft=null;this._notice=d.scope==='series'?'La série a été reprogrammée.':'Cette occurrence a été modifiée. Ses actions existantes sont conservées.';await this._load();return;}
      const initialIssue=validateSchedule(d,this._choices().map(r=>({...r,id:r.value})),Date.now(),this._config.demo);if(initialIssue)throw new Error(initialIssue);
      if(d.original)await this._freshForIfLive(d.original,d,d.scope);
      let actions=[...d.start_actions,...(d.has_end?d.end_actions:[])],resolved;
      if(this._config.demo){resolved=actions.map(a=>{if(a.target?.startsWith('entity:')){const r=this._record(a.target);if(!this._snapshot.records.some(x=>x.id===r.id))this._snapshot.records.push(r);return {...a,target:r.id};}return a;});}
      else{if(!this._snapshot.ready)this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);const result=await this._store.prepare(d.actionSnapshot,actions);this._snapshot=result.snapshot;resolved=result.actions;}
      const draft={...d,start_actions:resolved.slice(0,d.start_actions.length),end_actions:d.has_end?resolved.slice(d.start_actions.length):[],rrule:!d.uid && d.repeat==='weekly'?`FREQ=WEEKLY;BYDAY=${[...d.days].sort((a,b)=>((a+6)%7)-((b+6)%7)).map(i=>['SU','MO','TU','WE','TH','FR','SA'][i]).join(',')}`:d.rrule};
      const issue=validateSchedule(draft,this._snapshot.records,Date.now(),this._config.demo);if(issue)throw new Error(issue);
      const payload=schedulePayload(draft);if(!this._config.demo){if(d.original)await this._freshFor(d.original,draft,d.scope);else d.pendingCreate={start:draft.start,end:draft.end,description:payload.event.description};}await this._write(payload,draft);this._draft=null;this._notice=d.scope==='series'?'La série a été reprogrammée.':d.uid?'Cette occurrence a été modifiée.':'Programmation enregistrée.';await this._load();
    }catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _move(event,date,minute){
    if(this._busy || !event.uid)return;this._busy=true;this._error='';
    try{const dates=shiftedOccurrence(event,date,minute,this._zone);if(dates.start===event.start && dates.end===event.end)return;await this._freshForIfLive(event,dates);if(!this._config.demo && Date.parse(dates.start)<Date.now()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');const draft={...event,...dates,event_id:event.meta?.id};await this._write(calendarEditPayload(event,dates),draft);this._draft=null;this._notice='Cette occurrence a été déplacée. Les autres jours et les actions restent inchangés.';await this._load();}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _delete(){
    if(this._busy || !this._draft?.original)return;this._busy=true;this._error='';const d=this._draft,event=d.original,scope=d.deleteScope;
    try{let rows=this._events;if(!this._config.demo){rows=await this._freshFor(event);if(scope==='series'){const today=dayOf(Date.now(),this._zone);rows.push(...await this._fetch(shiftDay(today,-1),shiftDay(today,2)));}}const issue=mutationIssue(event,scope,rows);if(issue)throw new Error(issue);const payload=occurrenceDeletePayload(event,scope);try{await this._write(payload);}catch(error){if(this._config.demo)throw error;const fresh=await this._fetch(shiftDay(dayOf(event.start,this._zone),-1),shiftDay(dayOf(event.end,this._zone),2));if(fresh.some(x=>x.uid===event.uid && (scope==='series' || (x.recurrence_id || '')===(event.recurrence_id || ''))))throw error;}this._draft=null;this._notice=scope==='series'?'Série supprimée.':'Cette occurrence a été supprimée.';await this._load();}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _click(event){
    const target=event.target.closest('button');if(!target || this._busy)return;
    if(target.dataset.event && performance.now()<(this._suppressEventClickUntil || 0))return;
    if(target.hasAttribute('data-move-handle')){const item=this._events.find(x=>x.key===target.dataset.moveHandle);if(item){this._open(item,dayOf(item.start,this._zone));this.shadowRoot.querySelector('[name=date]')?.focus({preventScroll:true});}return;}
    if(target.hasAttribute('data-remove-action')){const row=target.closest('.action-row');this._draft[row.dataset.phase].splice(Number(row.dataset.index),1);this._render();return;}
    if(target.dataset.event){const item=this._events.find(x=>x.key===target.dataset.event);if(item)this._open(item,dayOf(item.start,this._zone));return;}
    if(target.dataset.day){this._selected=target.dataset.day;this._open(null,this._selected);return;}
    const action=target.dataset.action;
    if(action?.startsWith('view-')){this._view=action.slice(5);this._render();return;}
    switch(action){
      case 'dismiss-toast':this._error='';this._notice='';this._render();break;
      case 'new':this._open(null);break;
      case 'cancel':this._draft=null;this._error='';this._render();break;
      case 'settings':this._settings=!this._settings;this._draft=null;this._render();break;
      case 'new-device':this._openDevice();break;
      case 'edit-device':this._openDevice(target.dataset.deviceId);break;
      case 'device-cancel':this._deviceDraft=null;this._settings=true;this._error='';this._render();break;
      case 'configure-actions':this._draft.calendarOnly=false;this._draft.readonly=false;this._error='';this._render();break;
      case 'add-start':case 'add-end':this._draft[action==='add-start'?'start_actions':'end_actions'].push({target:'',op:''});this._render();break;
      case 'delete':case 'delete-series':this._draft.deleteScope=action==='delete'?'occurrence':'series';this._render();break;
      case 'keep':delete this._draft.deleteScope;this._render();break;
      case 'confirm-delete':await this._delete();break;
      case 'setup':this._busy=true;try{this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);this._notice='Exécution préparée en mode test.';this._error='';}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}break;
      case 'refresh':await this._load();break;
      case 'today':this._selected=dayOf(Date.now(),this._zone);this._month=this._selected.slice(0,7);this._render();await this._load();break;
      case 'previous':case 'next':if(this._loading)return;if(this._view==='week'){this._selected=shiftDay(this._selected,action==='next'?7:-7);this._month=this._selected.slice(0,7);}else{const date=new Date(`${this._month}-01T12:00Z`);date.setUTCMonth(date.getUTCMonth()+(action==='next'?1:-1));this._month=date.toISOString().slice(0,7);this._selected=`${this._month}-01`;}this._render();await this._load();break;
    }
  }
}
Object.assign(PlanningCard.prototype,PlanningInteractions,PlanningDeviceSettings);
if(!customElements.get('ha-planning-card'))customElements.define('ha-planning-card',PlanningCard);
if(!customElements.get('ha-planning-chauffe-card'))customElements.define('ha-planning-chauffe-card',class extends PlanningCard{});
window.customCards=window.customCards || [];
if(!window.customCards.some(c=>c.type==='ha-planning-card'))window.customCards.push({type:'ha-planning-card',name:'Planning',description:'Calendrier avec actions ponctuelles ou créneaux de début et de fin.',preview:true,documentationURL:'https://github.com/Euro-Locks-Belgium/ha-planning-card'});
