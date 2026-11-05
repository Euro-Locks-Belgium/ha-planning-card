class PlanningChauffeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('change', e => this._change(e));
    this.shadowRoot.addEventListener('click', e => this._groups(e));
  }
  set hass(value) { this._hass = value; if (!this._rendered) this._render(); }
  setConfig(value) { this._config = { demo: true, ...value, title: value.title === 'Planning de chauffe' ? 'Planning' : value.title, appearance: normalizeAppearance(value.appearance), devices: (value.devices || []).map(d => ({...d})), groups: (value.groups || DEFAULT_GROUPS).map(g => ({ name: g.name || '', calendar: g.calendar || '' })) }; this._render(); }
  _emit() { this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: { ...this._config, appearance: {...this._config.appearance}, devices: this._config.devices.map(d => ({ ...d })), groups: this._config.groups.map(g => ({ ...g })) } } })); }
  _groups(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'add-device') { this._config.devices.push({ id: '', name: '' }); this._emit(); this._render(); return; }
    if (button.dataset.removeDevice !== undefined) { this._config.devices.splice(Number(button.dataset.removeDevice), 1); this._emit(); this._render(); return; }
    if (button.dataset.action === 'add-group' && this._config.groups.length < 8) this._config.groups.push({ name: '', calendar: '' });
    else if (button.dataset.remove !== undefined) this._config.groups.splice(Number(button.dataset.remove), 1);
    else return;
    this._emit(); this._render();
  }
  _change(event) {
    const el = event.target;
    if (!el.dataset.field) return;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.appearance) { this._config.appearance[el.dataset.field] = el.dataset.field === 'first_day' ? Number(value) : value; this._emit(); return; }
    if (el.dataset.field === 'custom_accent') { this._config.appearance.accent_color = value ? '#03a9f4' : ''; this._emit(); this._render(); return; }
    if (el.dataset.device !== undefined) this._config.devices[Number(el.dataset.device)][el.dataset.field] = value;
    else if (el.dataset.group !== undefined) this._config.groups[Number(el.dataset.group)][el.dataset.field] = value;
    else this._config[el.dataset.field] = value;
    if (el.dataset.field === 'calendar' && el.dataset.group === undefined && value) this._config.demo = false;
    this._emit();
    if (el.dataset.field === 'demo' || el.dataset.field === 'calendar' || el.dataset.field === 'execution_automation') this._render();
  }
  _render() {
    if (!this._config || !this._hass) return;
    this._rendered = true;
    const calendars = Object.values(this._hass.states || {}).filter(s => s.entity_id.startsWith('calendar.'));
    const automations = Object.values(this._hass.states || {}).filter(e => e.entity_id.startsWith('automation.'));
    const appearance = this._config.appearance;
    const optionSelect = (label,field,options) => `<label>${label}<select data-appearance="true" data-field="${field}">${Object.entries(options).map(([value,text]) => `<option value="${value}" ${String(appearance[field]) === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
    const legacy = !this._config.calendar && !!this._config.closure_calendar;
    const select = (label, field, value, index) => `<label>${label}<select data-field="${field}" ${index === undefined ? '' : `data-group="${index}"`}><option value="">Choisir un calendrier</option>${calendars.map(s => `<option value="${esc(s.entity_id)}" ${value === s.entity_id ? 'selected' : ''}>${esc(s.attributes.friendly_name || s.entity_id)} (${esc(s.entity_id)})</option>`).join('')}</select></label>`;
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color)}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font:inherit}input,select,button{font:inherit;padding:10px;box-sizing:border-box;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:6px}input,select{width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px}fieldset{border:1px solid var(--divider-color);border-radius:8px;margin:15px 0;padding:12px}legend{padding:0 5px}button{min-height:40px}button:disabled{opacity:.5}</style>
      <label>Titre<input data-field="title" value="${esc(this._config.title || 'Planning')}"></label>
      ${select('Calendrier du planning', 'calendar', this._config.calendar)}
      <p>Un seul calendrier contient les programmations et les exclusions. Aucun groupe n’est nécessaire pour commencer.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${this._config.demo ? 'checked' : ''}>Mode local (sans enregistrement Home Assistant)</label>
      <p>Choisir un calendrier active le mode connecté. Le mode local permet de tester sans enregistrer d’événement.</p>
      <label>Automatisation des appareils<select data-field="execution_automation"><option value="">Gestion manuelle existante</option>${automations.map(e => `<option value="${esc(e.entity_id)}" ${e.entity_id === this._config.execution_automation ? 'selected' : ''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label>
      <p>Pour gérer les appareils depuis la carte, sélectionner l’automatisation créée avec le nouveau blueprint « Planning — appareils configurables ». Les appareils se gèrent ensuite dans l’onglet Appareils.</p>
      <details><summary>Personnalisation</summary>
      ${optionSelect('Vue initiale','default_view',{month:'Mois',week:'Semaine',agenda:'Agenda'})}
      ${optionSelect('Premier jour','first_day',{'1':'Lundi','0':'Dimanche'})}
      ${optionSelect('Format des heures','time_format',{'24':'24 heures','12':'12 heures'})}
      ${optionSelect('Densité','density',{comfortable:'Confortable',compact:'Compacte'})}
      ${optionSelect('Style des événements','event_style',{filled:'Fond coloré',outline:'Contour coloré',dot:'Repère de couleur'})}
      <label class="check"><input type="checkbox" data-appearance="true" data-field="show_weekends" ${appearance.show_weekends ? 'checked' : ''}>Afficher les week-ends</label>
      <label class="check"><input type="checkbox" data-appearance="true" data-field="show_device_names" ${appearance.show_device_names ? 'checked' : ''}>Noms des appareils en vues semaine et agenda</label>
      <label class="check"><input type="checkbox" data-field="custom_accent" ${appearance.accent_color ? 'checked' : ''}>Couleur d’accent personnalisée</label>
      ${appearance.accent_color ? `<label>Couleur d’accent<input type="color" data-appearance="true" data-field="accent_color" value="${appearance.accent_color}"></label>` : ''}
      </details>
      <div ${this._config.execution_automation ? 'hidden' : ''}><details ${this._config.devices.length ? 'open' : ''}><summary>Appareils programmables</summary>
      <p>Configuration initiale : mêmes identifiants que dans le catalogue du blueprint. Ensuite, chaque utilisateur coche les appareils dans ses programmations.</p>
      ${this._config.devices.map((d, i) => `<fieldset><legend>Appareil ${i + 1}</legend><label>Nom affiché<input data-field="name" data-device="${i}" value="${esc(d.name)}"></label><label>Identifiant<input data-field="id" data-device="${i}" pattern="[a-z0-9_]+" value="${esc(d.id)}"></label><button type="button" data-remove-device="${i}">Retirer cet appareil</button></fieldset>`).join('')}
      <button type="button" data-action="add-device">Ajouter un appareil</button></details></div>
      <details ${this._config.groups.length ? 'open' : ''}><summary>Groupes (facultatif)</summary>
      <p>Uniquement pour distinguer plusieurs ensembles d’appareils dans le même calendrier. Utiliser le même nom dans le filtre de groupe du blueprint.</p>
      ${legacy ? select('Ancien calendrier des exclusions', 'closure_calendar', this._config.closure_calendar) : ''}
      ${this._config.groups.map((g, i) => `<fieldset><legend>Groupe ${i + 1}</legend><label>Nom<input data-field="name" data-group="${i}" value="${esc(g.name)}"></label>${legacy && !this._config.demo ? select('Ancien calendrier du groupe', 'calendar', g.calendar, i) : ''}<button type="button" data-remove="${i}">Retirer ce groupe</button></fieldset>`).join('')}
      <button type="button" data-action="add-group" ${this._config.groups.length >= 8 ? 'disabled' : ''}>Ajouter un groupe</button>
      <p>Renommer un groupe nécessite de mettre à jour son filtre dans le blueprint. Retirer un groupe de la carte ne supprime aucun événement.</p></details>
      <p>Taille : dans une vue Sections, utiliser l’onglet Disposition de la carte. Une vue Panneau permet une page pleine largeur.</p>`;
  }
}
if (!customElements.get('ha-planning-chauffe-card-editor')) customElements.define('ha-planning-chauffe-card-editor', PlanningChauffeEditor);
if (!customElements.get('ha-planning-card-editor')) customElements.define('ha-planning-card-editor', class extends PlanningChauffeEditor {});
