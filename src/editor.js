class PlanningChauffeEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.addEventListener('change',e=>this._change(e));}
  set hass(value){this._hass=value;this._render();}
  setConfig(value){this._config={...value,title:value.title || 'Planning',demo:value.demo ?? !value.calendar,appearance:normalizeAppearance(value.appearance)};delete this._config.groups;delete this._config.closure_calendar;delete this._config.devices;this._render();}
  _change(event){
    const el=event.target;if(!el.dataset.field)return;
    const field=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.appearance)this._config.appearance[field]=field==='first_day'?Number(value):value;
    else this._config[field]=value;
    if(field==='calendar' && value)this._config.demo=false;
    this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:{...this._config,appearance:{...this._config.appearance}}}}));
    if(['calendar','demo'].includes(field))this._render();
  }
  _render(){
    if(!this._config || !this._hass)return;
    const c=this._config,a=c.appearance;
    const select=(label,field,options)=>`<label>${label}<select data-field="${field}" data-appearance="true">${Object.entries(options).map(([value,name])=>`<option value="${value}" ${String(a[field])===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    const calendars=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('calendar.'));
    this.shadowRoot.innerHTML=`<style>:host{display:block;color:var(--primary-text-color);font-family:inherit}label{display:flex;flex-direction:column;gap:6px;margin:14px 0}input,select{font:inherit;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:11px;box-sizing:border-box;width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}details{padding:14px 0;border-top:1px solid var(--divider-color)}summary{font-weight:600}h3{margin:12px 0 4px}</style>
      <h3>Votre planning</h3>
      <label>Nom de la carte<input data-field="title" value="${esc(c.title)}"></label>
      <label>Calendrier<select data-field="calendar"><option value="">Choisir un calendrier local</option>${calendars.map(e=>`<option value="${esc(e.entity_id)}" ${e.entity_id===c.calendar?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label>
      <p>Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${c.demo?'checked':''}>Essai local, sans enregistrement dans Home Assistant</label>
      <p>${c.demo?'Les actions sont simulées.':'L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.'}</p>
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
  }
}
if(!customElements.get('ha-planning-card-editor'))customElements.define('ha-planning-card-editor',PlanningChauffeEditor);
if(!customElements.get('ha-planning-chauffe-card-editor'))customElements.define('ha-planning-chauffe-card-editor',class extends PlanningChauffeEditor{});
