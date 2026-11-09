import {planningLanguage,PLANNING_LANGUAGES,PLANNING_LOCALES,localizePlanningRoot} from './i18n.js';
class PlanningChauffeEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.addEventListener('change',e=>this._change(e));this.shadowRoot.addEventListener('input',e=>{if(e.target.hasAttribute('data-entity-search')){this._search=e.target.value;this._filterEntities();}});}
  set hass(value){this._hass=value;this._render();}
  setConfig(value){planningLanguage(value.language);this._config={...value,title:value.title || 'Planning',language:value.language || 'auto',entities:selectedPlanningEntities(value.entities),demo:value.demo ?? !value.calendar,appearance:normalizeAppearance(value.appearance)};delete this._config.groups;delete this._config.closure_calendar;delete this._config.devices;this._render();}
  get _language(){return planningLanguage(this._config?.language || 'auto',this._hass);}
  get _locale(){return PLANNING_LOCALES[this._language];}
  _emit(){this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:{...this._config,entities:[...this._config.entities],appearance:{...this._config.appearance}}}}));}
  _filterEntities(){const term=(this._search || '').toLocaleLowerCase(this._locale);this.shadowRoot.querySelectorAll('[data-entity-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase(this._locale).includes(term);row.style.display=row.hidden?'none':'';});}
  _change(event){
    const el=event.target;
    if(el.dataset.planningEntity){const selected=new Set(this._config.entities);if(el.checked)selected.add(el.dataset.planningEntity);else selected.delete(el.dataset.planningEntity);this._config.entities=[...selected];this._emit();return;}
    if(!el.dataset.field)return;
    const field=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.appearance)this._config.appearance[field]=field==='first_day'?Number(value):value;
    else this._config[field]=value;
    if(field==='calendar' && value)this._config.demo=false;
    this._emit();
    if(['calendar','demo','language'].includes(field))this._render();
  }
  _render(){
    if(!this._config || !this._hass)return;
    const c=this._config,a=c.appearance;
    const select=(label,field,options)=>`<label>${label}<select data-field="${field}" data-appearance="true">${Object.entries(options).map(([value,name])=>`<option value="${value}" ${String(a[field])===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    const calendars=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('calendar.'));
    const devices=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('binary_sensor.') || Object.hasOwn(ACTION_TYPES,e.entity_id.split('.')[0])).sort((x,y)=>(x.attributes.friendly_name || x.entity_id).localeCompare(y.attributes.friendly_name || y.entity_id,this._locale));
    const automations=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('automation.'));
    this.shadowRoot.innerHTML=`<style>:host{display:block;color:var(--primary-text-color);font-family:inherit}label{display:flex;flex-direction:column;gap:6px;margin:14px 0}input,select{font:inherit;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:11px;box-sizing:border-box;width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}details{padding:14px 0;border-top:1px solid var(--divider-color)}summary{font-weight:600}h3{margin:12px 0 4px}</style>
      <h3>Votre planning</h3>
      <label>Nom de la carte<input data-field="title" value="${esc(c.title)}"></label>
      <label>Langue<select data-field="language"><option value="auto" ${c.language==='auto'?'selected':''}>Automatique (Home Assistant)</option>${Object.entries(PLANNING_LANGUAGES).map(([key,name])=>`<option translate="no" value="${key}" ${c.language===key?'selected':''}>${name}</option>`).join('')}</select></label>
      <label>Calendrier<select data-field="calendar"><option value="">Choisir un calendrier local</option>${calendars.map(e=>`<option translate="no" value="${esc(e.entity_id)}" ${e.entity_id===c.calendar?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label>
      <p>Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${c.demo?'checked':''}>Essai local, sans enregistrement dans Home Assistant</label>
      <p>${c.demo?'Les actions sont simulées.':'L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.'}</p>
      <details open><summary>Appareils proposés dans les programmations</summary>
      <p>Cochez les entités autorisées. Sans sélection, aucun nouvel appareil n’est proposé. Pour une Frech, autorisez aussi son script et son entrée de contrôle.</p>
      <label>Rechercher un appareil<input type="search" data-entity-search value="${esc(this._search || '')}" placeholder="Nom ou identifiant de l’entité"></label>
      <div class="entity-options" style="max-height:280px;overflow:auto;border:1px solid var(--divider-color);padding:0 12px;border-radius:8px">${devices.map(e=>`<label class="check" data-entity-row><input type="checkbox" data-planning-entity="${e.entity_id}" ${c.entities.includes(e.entity_id)?'checked':''}><span translate="no">${esc(e.attributes.friendly_name || e.entity_id)}<small style="display:block">${e.entity_id}</small></span></label>`).join('') || '<p>Aucune entité compatible disponible.</p>'}</div></details>
      <details><summary>Exécution existante / migration</summary><label>Automatisation déjà utilisée<select data-field="execution_automation"><option value="">Détection automatique</option>${automations.map(e=>`<option translate="no" value="${e.entity_id}" ${c.execution_automation===e.entity_id?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label><p>Choisir votre ancienne automatisation Planning permet de retrouver ses appareils Frech et leurs associations. Les nouvelles installations se préparent dans Réglages.</p></details>
      <details><summary>Personnalisation</summary>
      ${select('Vue initiale','default_view',{month:'Mois',week:'Semaine',agenda:'Agenda'})}
      ${select('Premier jour','first_day',{'1':'Lundi','0':'Dimanche'})}
      ${select('Format des heures','time_format',{'24':'24 heures','12':'12 heures'})}
      ${select('Densité','density',{comfortable:'Confortable',compact:'Compacte'})}
      ${select('Style des événements','event_style',{filled:'Fond coloré',outline:'Contour',dot:'Repère de couleur'})}
      <label class="check"><input type="checkbox" data-field="show_weekends" data-appearance="true" ${a.show_weekends?'checked':''}>Afficher les week-ends</label>
      <label class="check"><input type="checkbox" data-field="show_device_names" data-appearance="true" ${a.show_device_names?'checked':''}>Afficher les noms des appareils dans le calendrier</label>
      <label>Couleur principale<input type="color" data-field="accent_color" data-appearance="true" value="${eventColor(a.accent_color || '#31b8de')}"></label>
      </details><p>Taille : utilisez l’onglet Disposition dans une vue Sections, ou une vue Panneau pour la pleine largeur.</p>`;
    localizePlanningRoot(this.shadowRoot,this._language);this._filterEntities();
  }
}
if(!customElements.get('ha-planning-card-editor'))customElements.define('ha-planning-card-editor',PlanningChauffeEditor);
if(!customElements.get('ha-planning-chauffe-card-editor'))customElements.define('ha-planning-chauffe-card-editor',class extends PlanningChauffeEditor{});
