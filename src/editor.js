class PlanningChauffeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('change', e => this._change(e));
  }
  set hass(value) { this._hass = value; if (!this._rendered) this._render(); }
  setConfig(value) { this._config = { demo: true, ...value, groups: (value.groups || DEFAULT_GROUPS).map(g => ({ name: g.name, calendar: g.calendar || '' })) }; this._render(); }
  _change(event) {
    const el = event.target;
    if (!el.dataset.field) return;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.group !== undefined) this._config.groups[Number(el.dataset.group)][el.dataset.field] = value;
    else this._config[el.dataset.field] = value;
    this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: { ...this._config, groups: this._config.groups.map(g => ({ ...g })) } } }));
    if (el.dataset.field === 'demo') this._render();
  }
  _render() {
    if (!this._config || !this._hass) return;
    this._rendered = true;
    const calendars = Object.values(this._hass.states || {}).filter(s => s.entity_id.startsWith('calendar.'));
    const select = (label, field, value, index) => `<label>${label}<select data-field="${field}" ${index === undefined ? '' : `data-group="${index}"`}><option value="">Choisir un calendrier</option>${calendars.map(s => `<option value="${esc(s.entity_id)}" ${value === s.entity_id ? 'selected' : ''}>${esc(s.attributes.friendly_name || s.entity_id)} (${esc(s.entity_id)})</option>`).join('')}</select></label>`;
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color)}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font:inherit}input,select{font:inherit;padding:10px;width:100%;box-sizing:border-box;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:6px}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px}fieldset{border:1px solid var(--divider-color);border-radius:8px;margin:15px 0;padding:12px}legend{padding:0 5px}</style>
      <label>Titre<input data-field="title" value="${esc(this._config.title || 'Planning de chauffe')}"></label>
      <label class="check"><input type="checkbox" data-field="demo" ${this._config.demo ? 'checked' : ''}>Démonstration sans connexion aux calendriers</label>
      ${this._config.demo ? '<p>La démonstration n’enregistre aucun événement dans Home Assistant et ne commande aucun appareil.</p>' : `<p>Utilisez des calendriers locaux dédiés. La carte enregistre les événements ; le blueprint associé exécute les démarrages.</p>${select('Calendrier des fermetures', 'closure_calendar', this._config.closure_calendar)}${this._config.groups.map((g, i) => `<fieldset><legend>Groupe ${i + 1}</legend><label>Nom<input data-field="name" data-group="${i}" value="${esc(g.name)}"></label>${select('Calendrier de chauffe', 'calendar', g.calendar, i)}</fieldset>`).join('')}`}
      <p>Pour ajouter ou retirer des groupes (1 à 8), utilisez l’éditeur de code. Guide : README du dépôt GitHub.</p>`;
  }
}
if (!customElements.get('ha-planning-chauffe-card-editor')) customElements.define('ha-planning-chauffe-card-editor', PlanningChauffeEditor);
