class PlanningChauffeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('change', e => this._change(e));
    this.shadowRoot.addEventListener('click', e => this._groups(e));
  }
  set hass(value) { this._hass = value; if (!this._rendered) this._render(); }
  setConfig(value) { this._config = { demo: true, ...value, title: value.title === 'Planning de chauffe' ? 'Planning' : value.title, groups: (value.groups || DEFAULT_GROUPS).map(g => ({ name: g.name || '', calendar: g.calendar || '' })) }; this._render(); }
  _emit() { this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: { ...this._config, groups: this._config.groups.map(g => ({ ...g })) } } })); }
  _groups(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'add-group' && this._config.groups.length < 8) this._config.groups.push({ name: '', calendar: '' });
    else if (button.dataset.remove !== undefined) this._config.groups.splice(Number(button.dataset.remove), 1);
    else return;
    this._emit(); this._render();
  }
  _change(event) {
    const el = event.target;
    if (!el.dataset.field) return;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.group !== undefined) this._config.groups[Number(el.dataset.group)][el.dataset.field] = value;
    else this._config[el.dataset.field] = value;
    this._emit();
    if (el.dataset.field === 'demo') this._render();
  }
  _render() {
    if (!this._config || !this._hass) return;
    this._rendered = true;
    const calendars = Object.values(this._hass.states || {}).filter(s => s.entity_id.startsWith('calendar.'));
    const select = (label, field, value, index) => `<label>${label}<select data-field="${field}" ${index === undefined ? '' : `data-group="${index}"`}><option value="">Choisir un calendrier</option>${calendars.map(s => `<option value="${esc(s.entity_id)}" ${value === s.entity_id ? 'selected' : ''}>${esc(s.attributes.friendly_name || s.entity_id)} (${esc(s.entity_id)})</option>`).join('')}</select></label>`;
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color)}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font:inherit}input,select,button{font:inherit;padding:10px;box-sizing:border-box;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:6px}input,select{width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px}fieldset{border:1px solid var(--divider-color);border-radius:8px;margin:15px 0;padding:12px}legend{padding:0 5px}button{min-height:40px}button:disabled{opacity:.5}</style>
      <label>Titre<input data-field="title" value="${esc(this._config.title || 'Planning')}"></label>
      <label class="check"><input type="checkbox" data-field="demo" ${this._config.demo ? 'checked' : ''}>Mode local (sans enregistrement Home Assistant)</label>
      <p>Aucun groupe, horaire ou événement n’est ajouté automatiquement.</p>
      ${!this._config.demo ? `<p>Choisissez des calendriers locaux dédiés. Les actions sont exécutées par les automatisations associées.</p>${select('Calendrier des exclusions', 'closure_calendar', this._config.closure_calendar)}` : ''}
      ${this._config.groups.map((g, i) => `<fieldset><legend>Groupe ${i + 1}</legend><label>Nom<input data-field="name" data-group="${i}" value="${esc(g.name)}"></label>${!this._config.demo ? select('Calendrier', 'calendar', g.calendar, i) : ''}<button type="button" data-remove="${i}">Retirer ce groupe</button></fieldset>`).join('')}
      <button type="button" data-action="add-group" ${this._config.groups.length >= 8 ? 'disabled' : ''}>Ajouter un groupe</button>
      <p>Retirer un groupe de la carte ne supprime pas son calendrier.</p>
      <p>Taille : dans une vue Sections, utiliser l’onglet Disposition de la carte. Une vue Panneau permet une page pleine largeur.</p>`;
  }
}
if (!customElements.get('ha-planning-chauffe-card-editor')) customElements.define('ha-planning-chauffe-card-editor', PlanningChauffeEditor);
if (!customElements.get('ha-planning-card-editor')) customElements.define('ha-planning-card-editor', class extends PlanningChauffeEditor {});
