class PlanningChauffeCard extends HTMLElement {
  static getConfigElement() { return document.createElement('ha-planning-card-editor'); }
  static getStubConfig() { return { type: 'custom:ha-planning-card', title: 'Planning', demo: true, groups: [] }; }
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._events = []; this._view = 'calendar'; this._error = ''; this._message = ''; this._busy = false;
    this._loadId = 0;
    this.shadowRoot.addEventListener('click', e => this._click(e));
    this.shadowRoot.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.closest('form') && e.target.tagName !== 'BUTTON') { e.preventDefault(); this._review(); }
    });
    this.shadowRoot.addEventListener('submit', e => { e.preventDefault(); this._review(); });
  }
  setConfig(input) {
    this._config = validateConfig(input);
    this._loadId++; this._loading = false; this._initialized = false; this._editor = null; this._loaded = false; this._error = '';
    if (this._hass) this._initialize();
  }
  set hass(value) {
    this._hass = value;
    this.toggleAttribute('dark', value.themes?.darkMode === true);
    if (this._config && !this._initialized) this._initialize();
  }
  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (!this._config?.demo && !this._editor && !this._busy && this._hass) this._load(); }, 30000);
    if (this._initialized && !this._config.demo) this._load();
  }
  disconnectedCallback() { clearInterval(this._timer); this._loadId++; this._loading = false; }
  getCardSize() { return 16; }
  getGridOptions() { return { columns: 'full', rows: 14, min_columns: 6, min_rows: 8 }; }
  _q(selector) { return this.shadowRoot.querySelector(selector); }
  _initialize() {
    this._zone = this._hass.config?.time_zone || 'Europe/Brussels';
    this._runtimeGroups = resolveGroups(this._config, this._hass.states?.[this._config.calendar]?.attributes?.friendly_name);
    this._selected = dayOf(Date.now(), this._zone); this._month = this._selected.slice(0, 7);
    this._initialized = true; this._events = []; this._editor = null;
    if (this._config.demo) {
      const demo = emptyLocalState(this._zone);
      this._events = demo.events; this._selected = demo.selected; this._loaded = true; this._render();
    } else { this._render(); this._load(); }
  }
  _groups() { return this._runtimeGroups || []; }
  _implicitGroup() { return !!this._config.calendar && this._groups().length === 1 && this._groups()[0].id === ''; }
  _calendar(index) { return this._config.calendar || (this._config.demo ? `calendar.demo_group_${index}` : this._groups()[index].calendar); }
  _closureCalendar() { return this._config.calendar || (this._config.demo ? 'calendar.demo_closures' : this._config.closure_calendar); }
  _name(event) { return event.role === 'closure' ? event.summary : this._groups()[event.groupIndex]?.name || event.summary; }
  _date(instant, options = {}) { return new Intl.DateTimeFormat('fr-BE', { timeZone: this._zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...options }).format(new Date(instant)); }
  _dayLabel(day) { return new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00Z`)); }
  _status(event) { return eventStatus(event, this._events, this._zone); }
  _statusText(event) {
    return ({ closure: 'Exclusion', external: 'Événement non piloté', closed: 'Bloqué par exclusion', replaced: 'Remplacé pour ce cycle' })[this._status(event)] || (event.meta?.kind === 'restart' ? 'Programmation ponctuelle' : 'Horaire habituel');
  }
  _editable(event) { return !!event.uid && !!event.meta && (!event.rrule || event.meta.kind === 'weekly'); }
  _hasGroups() { return this._groups().some(g => g.name.trim()); }
  _needsSetup() { return !this._config.demo && !this._config.calendar && (!this._config.closure_calendar || !this._groups().length || this._groups().some(g => !g.calendar || !g.name.trim())); }
  _canWrite() { return this._config.demo || (this._loaded && !this._error && !this._loading); }
  async _fetch(startDay, endDay) {
    const sources = this._config.calendar ? [{ calendar: this._config.calendar, role: 'shared', index: null }] : [{ calendar: this._closureCalendar(), role: 'closure', index: null }, ...this._groups().map((g, i) => ({ calendar: this._calendar(i), role: 'group', index: i }))];
    const query = new URLSearchParams({ start: toInstant(`${startDay}T00:00`, this._zone), end: toInstant(`${endDay}T00:00`, this._zone) });
    const results = await Promise.all(sources.map(async source => {
      const entity = this._hass.states[source.calendar];
      if (!entity || !['on', 'off'].includes(entity.state)) throw new Error(`Calendrier indisponible : ${source.calendar}.`);
      if ((Number(entity.attributes.supported_features) & 7) !== 7) throw new Error(`Le calendrier ${source.calendar} ne permet pas toutes les modifications. Utilisez Calendrier local.`);
      const rows = await this._hass.callApi('GET', `calendars/${source.calendar}?${query}`);
      if (!Array.isArray(rows)) throw new Error('Réponse calendrier invalide.');
      return rows.map(e => normalizeEvent(e, source.calendar, source.role, source.index, this._zone, this._groups()));
    }));
    return results.flat();
  }
  async _load() {
    if (this._config.demo || this._loading || this._needsSetup()) return;
    const id = ++this._loadId; this._loading = true;
    if (!this._editor) this._render();
    try {
      const range = viewRange(this._month);
      const rows = await this._fetch(range.queryStart, range.queryEnd);
      if (id !== this._loadId) return;
      this._events = rows; this._error = ''; this._loaded = true;
    } catch (e) { if (id === this._loadId) { this._error = this._errorText(e); this._loaded = false; } }
    finally { if (id === this._loadId) { this._loading = false; if (!this._editor) this._render(); } }
  }
  _errorText(e) { return e?.message || 'Opération refusée ou connexion indisponible. Vérifiez les droits du compte et les calendriers.'; }
  _button(label, action, secondary = false, extra = '') { return `<button type="button" class="ha-button ${secondary ? '' : 'ha-primary'}" data-action="${action}" ${this._busy ? 'disabled' : ''} ${extra}>${label}</button>`; }
  _render() {
    if (!this._initialized) return;
    const disabled = this._busy || !this._canWrite() ? 'disabled' : '';
    this.shadowRoot.innerHTML = `<style>${STYLES}ha-icon{--mdc-icon-size:18px}.ha-review-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}</style><ha-card><div id="planning-root"><main class="ha-main">
      <div class="ha-heading"><div><h1>${esc(this._config.title)}</h1><p class="ha-secondary">Programmations ponctuelles, horaires récurrents et exclusions.</p></div><div class="ha-actions">${this._button('Ajouter une exclusion', 'new-closure', true, disabled)}${this._button('Ajouter une programmation', 'new-restart', false, !this._hasGroups() ? 'disabled' : disabled)}</div></div>
      <div class="ha-demo"><ha-icon icon="mdi:${this._config.demo ? 'flask-outline' : 'calendar-check'}"></ha-icon><span>${this._config.demo ? 'Mode local · aucun enregistrement dans Home Assistant' : 'Calendriers Home Assistant · exécution selon les automatisations configurées'}</span></div>
      ${this._error ? `<div class="ha-error ha-top-error" role="alert">${esc(this._error)} Les modifications sont bloquées. ${this._button('Réessayer', 'refresh', true)}</div>` : ''}
      ${!this._hasGroups() || this._needsSetup() ? '<p class="ha-secondary ha-setup" role="status">Choisissez le calendrier du planning dans l’éditeur de carte. Aucun groupe n’est nécessaire pour commencer.</p>' : ''}
      <div class="ha-tabs" role="tablist" aria-label="Vues du planning"><button type="button" role="tab" id="calendar-tab" aria-controls="calendar-panel" aria-selected="${this._view === 'calendar'}" data-view="calendar">Calendrier</button><button type="button" role="tab" id="weekly-tab" aria-controls="weekly-panel" aria-selected="${this._view === 'weekly'}" data-view="weekly">Horaires habituels</button></div>
      <section id="calendar-panel" role="tabpanel" aria-labelledby="calendar-tab" ${this._view !== 'calendar' ? 'hidden' : ''}><div class="ha-workspace"><section class="ha-calendar" aria-label="Calendrier">${this._calendarHtml()}</section><aside class="ha-sidebar">${this._editor ? this._editorHtml() : this._detailsHtml()}${this._closuresHtml()}<div class="ha-rule"><ha-icon icon="mdi:shield-check-outline"></ha-icon><span>Une exclusion bloque les activations pendant la période choisie.</span></div></aside></div></section>
      <section id="weekly-panel" role="tabpanel" aria-labelledby="weekly-tab" ${this._view !== 'weekly' ? 'hidden' : ''}>${this._weeklyHtml()}</section>
      <div class="ha-feedback" role="status" aria-live="polite">${esc(this._message)}</div>
      <footer class="ha-footer"><span>${this._config.demo ? 'Mode local' : 'Les calendriers sont partagés entre les utilisateurs.'}</span><span>v${VERSION} · ${esc(this._zone)}</span></footer>
      </main></div></ha-card>`;
  }
  _calendarHtml() {
    const range = viewRange(this._month);
    const month = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${this._month}-01T12:00:00Z`));
    let html = `<div class="ha-monthbar"><div class="ha-month-title"><h2>${esc(month.charAt(0).toUpperCase() + month.slice(1))}</h2><span class="ha-secondary">${this._loading ? 'Actualisation…' : esc(this._zone)}</span></div><div class="ha-monthnav"><button type="button" class="ha-iconbutton" data-action="refresh" aria-label="Actualiser">↻</button><button type="button" class="ha-iconbutton" data-action="prev-month" aria-label="Mois précédent">‹</button><button type="button" class="ha-iconbutton" data-action="next-month" aria-label="Mois suivant">›</button></div></div><div class="ha-days" aria-hidden="true">${['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'].map(d => `<span>${d}</span>`).join('')}</div><div class="ha-monthgrid" style="--planning-week-rows:${range.count / 7}">`;
    for (let i = 0; i < range.count; i++) {
      const day = shiftDay(range.start, i);
      const events = this._events.filter(e => e.role === 'group' && dayOf(e.start, this._zone) === day).sort((a, b) => a.start.localeCompare(b.start));
      const closed = this._events.some(e => e.role === 'closure' && e.start < toInstant(`${shiftDay(day, 1)}T00:00`, this._zone) && e.end > toInstant(`${day}T00:00`, this._zone));
      const summary = `${this._dayLabel(day)}${closed ? ', exclusion au moins partielle' : ''}${events.map(e => `, ${this._name(e)} ${localMinute(e.start, this._zone).slice(11)}, ${this._statusText(e)}`).join('')}`;
      html += `<button type="button" class="ha-day ${day.slice(0, 7) !== this._month ? 'outside' : ''} ${closed ? 'closed' : ''} ${day === this._selected ? 'selected' : ''}" data-day="${day}" aria-label="${esc(summary)}" aria-pressed="${day === this._selected}"><span class="ha-date">${Number(day.slice(8))}</span>${closed ? '<span class="ha-closed-label">Exclusion</span>' : ''}${events.slice(0, 3).map(e => `<span class="ha-dayevent ${['closed', 'replaced', 'external'].includes(this._status(e)) ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}">${esc(localMinute(e.start, this._zone).slice(11))} ${esc(this._name(e))}</span>`).join('')}${events.length > 3 ? `<span class="ha-secondary">+${events.length - 3}</span>` : ''}<span class="ha-mobile-events">${events.slice(0, 6).map(e => `<b class="ha-dot ${['closed','replaced','external'].includes(this._status(e)) ? 'blocked' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}"></b>`).join('')}</span></button>`;
    }
    return html + '</div><div class="ha-legend"><span><b class="ha-dot regular"></b>Habituel</span><span><b class="ha-dot exceptional"></b>Programmation ponctuelle</span><span><b class="ha-dot closure"></b>Exclusion</span><span><b class="ha-dot blocked"></b>Bloqué / remplacé</span></div>';
  }
  _detailsHtml() {
    const events = this._events.filter(e => e.role === 'group' && dayOf(e.start, this._zone) === this._selected).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel" aria-live="polite"><div class="ha-panel-title"><div><span class="ha-eyebrow">Programmations prévues</span><h2>${esc(this._dayLabel(this._selected))}</h2></div></div>${!events.length ? '<p class="ha-empty">Aucune programmation ce jour.</p>' : ''}${events.map(e => `<article class="ha-launch"><div class="ha-launchhead"><span>${esc(this._name(e))}</span><span class="ha-time">${esc(localMinute(e.start, this._zone).slice(11))}</span></div><span class="ha-badge ${this._status(e) !== 'planned' ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : ''}">${this._statusText(e)}</span>${e.meta?.note ? `<p>${esc(e.meta.note)}</p>` : ''}${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier${e.meta.kind === 'weekly' ? ' la série' : ''}</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>${e.meta.kind === 'weekly' ? 'Supprimer la série' : 'Supprimer la programmation'}</button></div>` : ''}</article>`).join('')}<button type="button" class="ha-textbutton" data-action="new-restart" ${!this._hasGroups() || !this._canWrite() ? 'disabled' : ''}>+ Ajouter une programmation</button></section>`;
  }
  _closuresHtml() {
    const closures = this._events.filter(e => e.role === 'closure' && e.end > toInstant(`${viewRange(this._month).start}T00:00`, this._zone)).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel"><div class="ha-panel-title"><h3>Périodes d’exclusion</h3></div>${!closures.length ? '<p class="ha-empty">Aucune exclusion sur la période affichée.</p>' : ''}${closures.map(e => `<article class="ha-closure-item"><h3>${esc(e.summary)}</h3><p>Du ${esc(this._date(e.start))}<br>au ${esc(this._date(e.end))}</p><span class="ha-badge cancelled">Démarrages bloqués</span>${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button></div>` : '<p>Géré depuis le calendrier Home Assistant.</p>'}</article>`).join('')}</section>`;
  }
  _weeklyHtml() {
    if (!this._hasGroups()) return '<h2>Horaires habituels</h2><p class="ha-empty">Choisissez un calendrier dans l’éditeur de carte pour ajouter un horaire.</p>';
    return `<div class="ha-weekly-head"><h2>Semaine habituelle</h2><p class="ha-secondary">Cycle hebdomadaire du dimanche au samedi. Une reprise peut remplacer l’horaire de ce cycle.</p></div>${this._groups().map((g, i) => {
      const found = this._events.find(e => e.groupIndex === i && e.meta?.kind === 'weekly');
      return `<article class="ha-weeklyrow"><div><h3>${esc(g.name || 'Groupe sans nom')}</h3><p class="ha-secondary">${found ? esc(new Intl.DateTimeFormat('fr-BE', { timeZone: this._zone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(found.start))) : 'Aucun horaire sur la période affichée.'}</p></div><div class="ha-actions">${found ? `<button type="button" class="ha-button" data-edit="${esc(found.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier la série</button><button type="button" class="ha-textbutton danger" data-delete="${esc(found.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button>` : `<button type="button" class="ha-button" data-weekly="${i}" ${!this._canWrite() || !g.name.trim() ? 'disabled' : ''}>Ajouter un horaire</button>`}</div></article>`;
    }).join('')}`;
  }
  _field(label, name, type, value) { return `<label class="ha-field">${label}<input type="${type}" name="${name}" value="${esc(value)}" required ${this._busy ? 'disabled' : ''}></label>`; }
  _editorHtml() {
    const d = this._draft, editing = !!d.uid;
    const title = this._editor === 'delete' ? 'Confirmer la suppression' : `${editing ? 'Modifier' : 'Programmer'} ${d.kind === 'closure' ? 'une exclusion' : d.kind === 'weekly' ? 'un horaire habituel' : 'une programmation'}`;
    let html = `<section class="ha-panel ha-editor" aria-label="Formulaire de programmation"><div class="ha-panel-title"><h3>${title}</h3><button type="button" class="ha-iconbutton" data-action="close-editor" aria-label="Fermer" ${this._busy ? 'disabled' : ''}>×</button></div>`;
    if (this._editor === 'review' || this._editor === 'delete') {
      html += `<div class="ha-summary"><strong>${esc(d.summary)}</strong>${this._editor === 'delete' ? (d.kind === 'weekly' ? 'Toute la série hebdomadaire sera supprimée.' : 'Cet événement sera supprimé du calendrier.') : d.kind === 'closure' ? `Du ${esc(this._date(d.start))} au ${esc(this._date(d.end))}. Les activations pendant cette période seront bloquées.` : `${esc(this._date(d.start))}${d.kind === 'weekly' ? ' · toutes les semaines' : d.replace ? '<br>Remplace l’horaire habituel de ce groupe pour ce cycle.' : '<br>Ajoute une programmation ponctuelle.'}`}</div>${this._editor === 'review' && d.uid && d.kind === 'weekly' ? '<p class="ha-secondary ha-note">Cette modification concerne toute la série hebdomadaire.</p>' : ''}<div class="ha-review-buttons">${this._button(this._busy ? 'Enregistrement…' : this._config.demo ? 'Confirmer en mode local' : 'Confirmer dans Home Assistant', this._editor === 'delete' ? 'confirm-delete' : 'save')}${this._button('Retour', 'back', true)}</div>`;
    } else {
      html += '<form><div class="ha-settings">';
      if (d.kind === 'closure') html += `<div class="ha-wide">${this._field('Libellé', 'summary', 'text', d.summary)}${this._field('Début de la période', 'start', 'datetime-local', d.start ? localMinute(d.start, this._zone) : '')}${this._field('Fin de la période', 'end', 'datetime-local', d.end ? localMinute(d.end, this._zone) : '')}</div>`;
      else {
        if (this._implicitGroup()) html += `<p class="ha-secondary ha-wide">Calendrier : ${esc(this._groups()[0].name)}</p>`;
        else html += `<label class="ha-field ha-wide">Groupe<select name="group" required ${editing ? 'disabled' : ''}><option value="">Choisir un groupe</option>${this._groups().map((g, i) => `<option value="${i}" ${i === d.groupIndex ? 'selected' : ''} ${!g.name.trim() ? 'disabled' : ''}>${esc(g.name)}</option>`).join('')}</select></label>`;
        if (d.kind === 'weekly') html += `<label class="ha-field">Jour<select name="day" required><option value="">Choisir un jour</option>${['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map((name, i) => `<option value="${i}" ${d.start && i === weekday(dayOf(d.start, this._zone)) ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
        else html += this._field('Date', 'date', 'date', d.start ? dayOf(d.start, this._zone) : '');
        html += this._field('Heure', 'time', 'time', d.start ? localMinute(d.start, this._zone).slice(11) : '');
        if (d.kind === 'restart') html += `<label class="ha-check ha-wide"><input type="checkbox" name="replace" ${d.replace ? 'checked' : ''}>Remplacer l’horaire habituel pour ce cycle</label>`;
      }
      html += `<label class="ha-field ha-wide">Note (facultative)<input type="text" name="note" maxlength="500" value="${esc(d.note || '')}"></label></div>${!this._config.demo && d.kind !== 'closure' ? `<p class="ha-secondary">Prévoir au moins ${MIN_LEAD_MINUTES} minutes. Heure du site : ${esc(this._zone)}.</p>` : ''}<div class="ha-review-buttons">${this._button('Vérifier la programmation', 'review')}${this._button('Annuler', 'close-editor', true)}</div></form>`;
    }
    return html + `${this._formError ? `<div class="ha-error" role="alert">${esc(this._formError)}</div>` : ''}</section>`;
  }
  _open(kind, event, index = null) {
    if (!this._canWrite() || this._busy) return;
    if (kind !== 'closure' && !this._hasGroups()) return;
    this._view = 'calendar'; this._message = ''; this._formError = ''; this._original = event || null;
    if (!event && kind !== 'closure' && this._implicitGroup()) index = 0;
    this._draft = event ? { ...event, kind: event.meta.kind, note: event.meta.note || '', replace: event.meta.replace === true, event_id: event.meta.id } : { kind, groupIndex: index, calendar: kind === 'closure' ? this._closureCalendar() : index === null ? '' : this._calendar(index), start: '', end: '', summary: '', replace: false, event_id: newEventId() };
    this._editor = 'form'; this._render();
    this._q('.ha-editor input:not([disabled]),.ha-editor select:not([disabled])')?.focus({ preventScroll: true });
  }
  _review() {
    if (this._busy || this._editor !== 'form') return;
    const form = this._q('form'); if (!form?.reportValidity()) return;
    const data = new FormData(form), d = { ...this._draft };
    try {
      if (d.kind === 'closure') { d.summary = data.get('summary').trim(); d.start = toInstant(data.get('start'), this._zone); d.end = toInstant(data.get('end'), this._zone); }
      else {
        if (!d.uid) d.groupIndex = this._implicitGroup() ? 0 : Number(data.get('group'));
        d.calendar = this._calendar(d.groupIndex);
        d.group = this._config.calendar ? this._groups()[d.groupIndex].id : undefined;
        d.start = d.kind === 'weekly' ? nextWeekly(Number(data.get('day')), data.get('time'), this._zone) : toInstant(`${data.get('date')}T${data.get('time')}`, this._zone);
        d.end = new Date(Date.parse(d.start) + 300000).toISOString();
        d.summary = `${d.kind === 'weekly' ? 'Horaire habituel' : 'Programmation'} · ${this._groups()[d.groupIndex].name}`;
        if (d.kind === 'weekly') d.rrule = `FREQ=WEEKLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][Number(data.get('day'))]}`;
        d.replace = data.get('replace') === 'on';
      }
      d.note = data.get('note') || ''; this._draft = d;
      const issue = validateDraft(d, this._events, this._zone, Date.now(), this._config.demo);
      if (issue) throw new Error(issue);
      this._editor = 'review'; this._formError = ''; this._render();
    } catch (e) { this._formError = this._errorText(e); this._render(); }
  }
  _fingerprint(event) {
    return JSON.stringify([event.summary, event.description || '', event.rrule || '', event.meta?.kind === 'weekly' ? `${weekday(dayOf(event.start, this._zone))}|${localMinute(event.start, this._zone).slice(11)}` : event.start, event.meta?.kind === 'weekly' ? '' : event.end]);
  }
  async _freshForDraft() {
    const d = this._draft;
    let from = shiftDay(cycleDay(dayOf(d.start, this._zone)), -1), to = shiftDay(from, 16);
    if (this._original) { from = [from, shiftDay(dayOf(this._original.start, this._zone), -1)].sort()[0]; to = [to, shiftDay(dayOf(this._original.end, this._zone), 1)].sort().at(-1); }
    if (d.kind === 'weekly') { from = [from, dayOf(Date.now(), this._zone)].sort()[0]; to = [to, shiftDay(dayOf(Date.now(), this._zone), 90)].sort().at(-1); }
    return this._fetch(from, to);
  }
  async _save(remove = false) {
    if (this._busy) return;
    this._busy = true; this._formError = ''; this._render();
    try {
      const d = this._draft;
      if (!this._config.demo) {
        const fresh = await this._freshForDraft();
        const original = this._original && fresh.find(e => e.calendar === this._original.calendar && e.uid === this._original.uid);
        if (this._original && (!original || this._fingerprint(original) !== this._fingerprint(this._original))) throw new Error('Cet événement a changé depuis son ouverture. Fermez le formulaire, actualisez puis recommencez.');
        if (!remove) {
          const alreadyCreated = !d.uid && d.event_id && fresh.some(e => e.meta?.id === d.event_id && e.calendar === d.calendar);
          if (!alreadyCreated) {
            const issue = validateDraft(d, fresh, this._zone);
            if (issue) throw new Error(issue);
            await this._hass.callWS(calendarPayload(d));
          }
        } else await this._hass.callWS(deletionPayload(d));
      } else this._saveDemo(remove);
      this._editor = null; this._selected = dayOf(d.start, this._zone); this._month = this._selected.slice(0, 7);
      this._message = `${remove ? 'Événement supprimé.' : 'Programmation enregistrée.'}${this._config.demo ? ' Mode local uniquement.' : ' Aucun relais n’est commandé par la carte.'}`;
      if (!this._config.demo) await this._load();
    } catch (e) { this._formError = this._errorText(e); }
    finally { this._busy = false; this._render(); }
  }
  _saveDemo(remove) {
    const d = this._draft;
    if (d.uid) this._events = this._events.filter(e => !(e.uid === d.uid && e.calendar === d.calendar));
    if (remove) return;
    const payload = calendarPayload(d), uid = d.uid || newEventId();
    const add = start => this._events.push(normalizeEvent({ ...payload.event, uid, start, end: new Date(Date.parse(start) + (Date.parse(d.end) - Date.parse(d.start))).toISOString() }, d.calendar, d.kind === 'closure' ? 'closure' : 'group', d.groupIndex, this._zone));
    if (d.kind === 'weekly') {
      const day = weekday(dayOf(d.start, this._zone)), time = localMinute(d.start, this._zone).slice(11), range = viewRange(this._month);
      for (let date = [range.queryStart, dayOf(d.start, this._zone)].sort().at(-1); date < shiftDay(range.queryEnd, 30); date = shiftDay(date, 1)) if (weekday(date) === day) add(toInstant(`${date}T${time}`, this._zone));
    } else add(d.start);
  }
  async _click(event) {
    const button = event.target.closest('button'); if (!button || button.disabled || this._busy) return;
    if (button.dataset.view) { this._view = button.dataset.view; this._render(); return; }
    if (button.dataset.day) { this._selected = button.dataset.day; this._editor = null; this._render(); return; }
    if (button.dataset.weekly !== undefined) { this._open('weekly', null, Number(button.dataset.weekly)); return; }
    if (button.dataset.edit) { const item = this._events.find(e => e.key === button.dataset.edit); if (item) this._open(item.meta.kind, item); return; }
    if (button.dataset.delete) { const item = this._events.find(e => e.key === button.dataset.delete); if (item) { this._open(item.meta.kind, item); this._editor = 'delete'; this._render(); } return; }
    switch (button.dataset.action) {
      case 'new-closure': this._open('closure'); break;
      case 'new-restart': this._open('restart'); break;
      case 'close-editor': this._editor = null; this._render(); break;
      case 'back': if (this._editor === 'delete') this._editor = null; else this._editor = 'form'; this._formError = ''; this._render(); break;
      case 'review': this._review(); break;
      case 'save': await this._save(); break;
      case 'confirm-delete': await this._save(true); break;
      case 'refresh': if (!this._config.demo) await this._load(); else { this._message = 'Mode local, sans appel à Home Assistant.'; this._render(); } break;
      case 'prev-month': case 'next-month': {
        if (this._loading) return;
        const date = new Date(`${this._month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + (button.dataset.action === 'next-month' ? 1 : -1));
        this._month = date.toISOString().slice(0, 7); this._editor = null; this._render(); if (!this._config.demo) await this._load(); break;
      }
    }
  }
}
if (!customElements.get('ha-planning-chauffe-card')) customElements.define('ha-planning-chauffe-card', PlanningChauffeCard);
if (!customElements.get('ha-planning-card')) customElements.define('ha-planning-card', class extends PlanningChauffeCard {});
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'ha-planning-card')) window.customCards.push({ type: 'ha-planning-card', name: 'Planning', description: 'Programmations, horaires récurrents et exclusions. Démarre vide.', preview: true, documentationURL: 'https://github.com/Euro-Locks-Belgium/ha-planning-card' });
