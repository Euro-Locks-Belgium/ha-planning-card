import {planningLanguage,planningTranslate,PLANNING_LANGUAGES,PLANNING_LOCALES,localizePlanningRoot} from './i18n.js';
import {stableJson} from './devices.js';

class PlanningChauffeEditor extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._tab='general';this._textSources=new WeakMap();this._attributeSources=new WeakMap();this._pendingValues=new Set();this._shownValues={};
    this.shadowRoot.addEventListener('change',e=>this._change(e));
    this.shadowRoot.addEventListener('input',e=>{if(e.target.hasAttribute('data-entity-search')){this._search=e.target.value;this._filterEntities();}});
    this.shadowRoot.addEventListener('click',e=>{const tab=e.target.closest('[data-editor-tab]');if(tab)this._selectTab(tab.dataset.editorTab);});
    this.shadowRoot.addEventListener('keydown',e=>this._tabKey(e));
    this.shadowRoot.addEventListener('focusout',()=>queueMicrotask(()=>{if(this._pendingStructure || this._pendingValues.size)this._render();}));
  }
  set hass(value){this._hass=value;this._render();}
  setConfig(value){planningLanguage(value.language);this._config={...value,title:value.title || 'Planning',language:value.language || 'auto',entities:selectedPlanningEntities(value.entities),demo:value.demo ?? !value.calendar,appearance:normalizeAppearance(value.appearance)};delete this._config.groups;delete this._config.closure_calendar;delete this._config.devices;this._render();}
  get _language(){return planningLanguage(this._config?.language || 'auto',this._hass);}
  get _locale(){return PLANNING_LOCALES[this._language];}
  _t(value){return planningTranslate(this._language,value);}
  _emit(){this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:{...this._config,entities:[...this._config.entities],appearance:{...this._config.appearance}}}}));}
  _filterEntities(){const term=(this._search || '').toLocaleLowerCase(this._locale);this.shadowRoot.querySelectorAll('[data-entity-row]').forEach(row=>{const hidden=!row.textContent.toLocaleLowerCase(this._locale).includes(term);if(row.hidden!==hidden)row.hidden=hidden;});}
  _change(event){
    const el=event.target;
    if(el.dataset.planningEntity){const selected=new Set(this._config.entities);if(el.checked)selected.add(el.dataset.planningEntity);else selected.delete(el.dataset.planningEntity);this._config.entities=[...selected];this._emit();this._render(el);return;}
    if(!el.dataset.field)return;
    const field=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.appearance)this._config.appearance[field]=field==='first_day'?Number(value):value;else this._config[field]=value;
    if(field==='calendar' && value)this._config.demo=false;
    this._emit();this._render(el);
  }
  _selectTab(id,focus=false){
    const buttons=[...this.shadowRoot.querySelectorAll('[data-editor-tab]')];if(!buttons.some(button=>button.dataset.editorTab===id))return;this._tab=id;
    for(const button of buttons){const selected=button.dataset.editorTab===id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
    for(const panel of this.shadowRoot.querySelectorAll('[data-editor-panel]'))panel.hidden=panel.dataset.editorPanel!==id;
    if(focus){const button=buttons.find(button=>button.dataset.editorTab===id);button.focus({preventScroll:true});button.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  _tabKey(event){const button=event.target.closest('[data-editor-tab]');if(!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...this.shadowRoot.querySelectorAll('[data-editor-tab]')],index=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;this._selectTab(buttons[next].dataset.editorTab,true);}
  _mount(){
    const select=(label,field,options)=>`<label>${label}<select data-field="${field}" data-appearance="true">${Object.entries(options).map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></label>`;
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;color:var(--primary-text-color);font-family:inherit;--editor-accent:var(--primary-color,#31b8de)}
      .editor-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--divider-color);padding:0 0 3px;scrollbar-width:thin}
      .editor-tabs button{flex:0 0 auto;min-height:40px;padding:8px 10px;border:0;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;background:transparent;color:var(--secondary-text-color);font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
      .editor-tabs button:hover{background:var(--secondary-background-color)}.editor-tabs button[aria-selected=true]{color:var(--editor-accent);border-bottom-color:var(--editor-accent);background:color-mix(in srgb,var(--editor-accent) 8%,transparent)}
      .editor-tabs button:focus-visible{outline:2px solid var(--editor-accent);outline-offset:-2px}.editor-panel{padding-top:8px}.editor-panel[hidden],[data-entity-row][hidden]{display:none}
      label{display:flex;flex-direction:column;gap:6px;margin:14px 0}input,select{font:inherit;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:11px;box-sizing:border-box;width:100%}input[type=color]{width:70px;height:42px;padding:4px;cursor:pointer}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}h3{margin:12px 0 4px;font-size:16px}.entity-options{max-height:280px;overflow:auto;border:1px solid var(--divider-color);padding:0 12px;border-radius:8px}.entity-options small{display:block}.editor-size-hint{margin-top:18px}
      </style>
      <div class="editor-tabs" role="tablist" aria-label="Rubriques de configuration">${Object.entries({general:'Général',devices:'Appareils',appearance:'Affichage',advanced:'Avancé'}).map(([id,label])=>`<button type="button" role="tab" id="editor-tab-${id}" data-editor-tab="${id}" aria-controls="editor-panel-${id}">${label}</button>`).join('')}</div>
      <section class="editor-panel" role="tabpanel" id="editor-panel-general" data-editor-panel="general" aria-labelledby="editor-tab-general">
      <h3>Votre planning</h3><label>Nom de la carte<input data-field="title"></label>
      <label>Langue<select data-field="language"><option value="auto">Automatique (Home Assistant)</option>${Object.entries(PLANNING_LANGUAGES).map(([key,name])=>`<option translate="no" value="${key}">${name}</option>`).join('')}</select></label>
      <label>Calendrier<select data-field="calendar"></select></label><p>Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.</p>
      <label class="check"><input type="checkbox" data-field="demo">Essai local, sans enregistrement dans Home Assistant</label><p data-demo-note translate="no"></p></section>
      <section class="editor-panel" role="tabpanel" id="editor-panel-devices" data-editor-panel="devices" aria-labelledby="editor-tab-devices" hidden>
      <h3>Appareils proposés dans les programmations</h3><p>Cochez les entités autorisées. Sans sélection, aucun nouvel appareil n’est proposé. Pour une Frech, autorisez aussi son script et son entrée de contrôle.</p>
      <label>Rechercher un appareil<input type="search" data-entity-search placeholder="Nom ou identifiant de l’entité"></label><div class="entity-options"></div></section>
      <section class="editor-panel" role="tabpanel" id="editor-panel-appearance" data-editor-panel="appearance" aria-labelledby="editor-tab-appearance" hidden>
      <h3>Personnalisation</h3>${select('Vue initiale','default_view',{month:'Mois',week:'Semaine',agenda:'Agenda'})}${select('Premier jour','first_day',{'1':'Lundi','0':'Dimanche'})}${select('Format des heures','time_format',{'24':'24 heures','12':'12 heures'})}${select('Densité','density',{comfortable:'Confortable',compact:'Compacte'})}${select('Style des événements','event_style',{filled:'Fond coloré',outline:'Contour',dot:'Repère de couleur'})}
      <label class="check"><input type="checkbox" data-field="show_weekends" data-appearance="true">Afficher les week-ends</label><label class="check"><input type="checkbox" data-field="show_device_names" data-appearance="true">Afficher les noms des appareils dans le calendrier</label><label>Couleur principale<input type="color" data-field="accent_color" data-appearance="true"></label></section>
      <section class="editor-panel" role="tabpanel" id="editor-panel-advanced" data-editor-panel="advanced" aria-labelledby="editor-tab-advanced" hidden>
      <h3>Exécution existante / migration</h3><label>Automatisation déjà utilisée<select data-field="execution_automation"></select></label><p>Choisir votre ancienne automatisation Planning permet de retrouver ses appareils Frech et leurs associations. Les nouvelles installations se préparent dans Réglages.</p></section>
      <p class="editor-size-hint">Taille : utilisez l’onglet Disposition dans une vue Sections, ou une vue Panneau pour la pleine largeur.</p>`;
    this._mounted=true;this._selectTab(this._tab);
  }
  _options(select,rows,placeholder,value){
    const entries=[{id:'',name:placeholder,translate:true},...rows];if(value && !entries.some(row=>row.id===value))entries.push({id:value,name:`${value} (${this._t('indisponible')})`});
    select.replaceChildren(...entries.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.name;if(!row.translate)option.setAttribute('translate','no');return option;}));
    select.value=value || '';
  }
  _devices(rows){
    const list=this.shadowRoot.querySelector('.entity-options'),existing=new Map([...list.querySelectorAll('[data-entity-row]')].map(row=>[row.dataset.entityRow,row]));let cursor=list.firstElementChild;
    for(const state of rows){let row=existing.get(state.entity_id);if(!row){row=document.createElement('label');row.className='check';row.dataset.entityRow=state.entity_id;row.innerHTML=`<input type="checkbox" data-planning-entity="${esc(state.entity_id)}"><span translate="no"><span data-entity-name></span><small></small></span>`;}
      const name=row.querySelector('[data-entity-name]'),label=state.attributes.friendly_name || state.entity_id;if(name.textContent!==label)name.textContent=label;row.querySelector('small').textContent=state.entity_id;
      if(row===cursor)cursor=cursor.nextElementSibling;else list.insertBefore(row,cursor);existing.delete(state.entity_id);
    }
    for(const row of existing.values())row.remove();let empty=list.querySelector('[data-entity-empty]');if(!rows.length && !empty){empty=document.createElement('p');empty.dataset.entityEmpty='';empty.setAttribute('translate','no');list.append(empty);}if(empty){if(rows.length)empty.remove();else empty.textContent=this._t('Aucune entité compatible disponible.');}
  }
  _translate(){
    // Retain the French sources so a persistent node can switch FR/EN/NL/IT.
    const skip=el=>!el || !!el.closest('[translate="no"],script,style,textarea'),walker=document.createTreeWalker(this.shadowRoot,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))if(!skip(node.parentElement)){if(!this._textSources.has(node))this._textSources.set(node,node.nodeValue);else node.nodeValue=this._textSources.get(node);}
    for(const el of this.shadowRoot.querySelectorAll('[title],[aria-label],[placeholder]'))if(!skip(el)){const saved=this._attributeSources.get(el) || {};for(const name of ['title','aria-label','placeholder'])if(el.hasAttribute(name)){if(!(name in saved))saved[name]=el.getAttribute(name);else el.setAttribute(name,saved[name]);}this._attributeSources.set(el,saved);}
    localizePlanningRoot(this.shadowRoot,this._language);
  }
  _render(committedControl=null){
    if(!this._config || !this._hass)return;if(!this._mounted)this._mount();
    const c=this._config,a=c.appearance,language=this._language,active=this.shadowRoot.activeElement;
    const values={title:c.title,language:c.language,calendar:c.calendar || '',demo:c.demo,execution_automation:c.execution_automation || '',...a,accent_color:eventColor(a.accent_color || '#31b8de')};
    const relevant=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('calendar.') || e.entity_id.startsWith('automation.') || e.entity_id.startsWith('binary_sensor.') || Object.hasOwn(ACTION_TYPES,e.entity_id.split('.')[0]));
    const optionSignature=JSON.stringify([language,c.calendar,c.execution_automation,relevant.map(e=>[e.entity_id,e.attributes.friendly_name || e.entity_id])]),configSignature=stableJson({values,entities:c.entities});
    if(configSignature===this._configSignature && optionSignature===this._optionSignature && language===this._renderedLanguage && !this._pendingValues.size){this._pendingStructure=false;return;}
    const structuralChange=optionSignature!==this._optionSignature || language!==this._renderedLanguage;
    if(structuralChange && active?.tagName==='SELECT' && active!==committedControl)this._pendingStructure=true;
    else if(structuralChange){
      const devices=relevant.filter(e=>!e.entity_id.startsWith('calendar.')&&!e.entity_id.startsWith('automation.')).sort((x,y)=>(x.attributes.friendly_name || x.entity_id).localeCompare(y.attributes.friendly_name || y.entity_id,this._locale)),options=prefix=>relevant.filter(e=>e.entity_id.startsWith(prefix)).map(e=>({id:e.entity_id,name:e.attributes.friendly_name || e.entity_id}));
      this._options(this.shadowRoot.querySelector('[data-field=calendar]'),options('calendar.'),'Choisir un calendrier local',c.calendar);this._options(this.shadowRoot.querySelector('[data-field=execution_automation]'),options('automation.'),'Détection automatique',c.execution_automation);this._devices(devices);
      this._optionSignature=optionSignature;this._pendingStructure=false;this._translate();this._renderedLanguage=language;
    }
    for(const control of this.shadowRoot.querySelectorAll('[data-field]')){const field=control.dataset.field,desired=values[field],changed=this._shownValues[field]!==desired || this._pendingValues.has(field);if(!changed)continue;
      if(control===active && (control.type==='checkbox'?control.checked!==desired:control.value!==String(desired ?? ''))){this._pendingValues.add(field);continue;}
      if(control.type==='checkbox'){if(control.checked!==desired)control.checked=!!desired;}else if(control.value!==String(desired ?? ''))control.value=String(desired ?? '');this._shownValues[field]=desired;this._pendingValues.delete(field);
    }
    for(const check of this.shadowRoot.querySelectorAll('[data-planning-entity]')){const checked=c.entities.includes(check.dataset.planningEntity);if(check.checked!==checked)check.checked=checked;}
    const note=this.shadowRoot.querySelector('[data-demo-note]'),message=this._t(c.demo?'Les actions sont simulées.':'L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.');if(note.textContent!==message)note.textContent=message;
    this._filterEntities();this._configSignature=configSignature;
  }
}
if(!customElements.get('ha-planning-card-editor'))customElements.define('ha-planning-card-editor',PlanningChauffeEditor);
if(!customElements.get('ha-planning-chauffe-card-editor'))customElements.define('ha-planning-chauffe-card-editor',class extends PlanningChauffeEditor{});
