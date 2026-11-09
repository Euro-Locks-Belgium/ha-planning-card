export const DEFAULT_APPEARANCE = { default_view: 'month', first_day: 1, time_format: '24', density: 'compact', event_style: 'filled', show_weekends: true, show_device_names: true, accent_color: '' };
export function normalizeAppearance(input = {}) {
  const options = { ...DEFAULT_APPEARANCE, ...input };
  for (const [key, choices] of Object.entries({default_view:['month','week','agenda'],first_day:[0,1],time_format:['12','24'],density:['compact','comfortable'],event_style:['filled','outline','dot']})) {
    if (!choices.includes(options[key])) throw new Error(`Réglage d’affichage invalide : ${key}.`);
  }
  for (const key of ['show_weekends','show_device_names']) if (typeof options[key] !== 'boolean') throw new Error(`Réglage d’affichage invalide : ${key}.`);
  if (options.accent_color && !/^#[0-9a-f]{6}$/i.test(options.accent_color)) throw new Error('Couleur d’accent invalide.');
  return options;
}
export function visibleWeekdays(firstDay = 1, weekends = true) {
  return Array.from({length:7}, (_, i) => (i + firstDay) % 7).filter(day => weekends || (day !== 0 && day !== 6));
}

export const PlanningCalendarViews = {
  _calendarDisplayHtml() {
    const controls = `<div class="ha-calendar-views" aria-label="Affichage du calendrier">${Object.entries({month:'Mois',week:'Semaine',agenda:'Agenda'}).map(([id,label]) => `<button type="button" class="ha-textbutton" data-calendar-view="${id}" aria-pressed="${this._calendarView === id}">${label}</button>`).join('')}${this._button('Aujourd’hui','today',true)}</div>`;
    return controls + (this._calendarView === 'week' ? this._weekHtml() : this._calendarView === 'agenda' ? this._agendaHtml() : this._calendarHtml());
  },
  _viewNavigationHtml(title) {
    return `<div class="ha-monthbar"><h2>${esc(title)}</h2><div class="ha-monthnav"><button type="button" class="ha-iconbutton" data-action="refresh" aria-label="Actualiser">↻</button><button type="button" class="ha-iconbutton" data-action="prev-month" aria-label="Période précédente">‹</button><button type="button" class="ha-iconbutton" data-action="next-month" aria-label="Période suivante">›</button></div></div>`;
  },
  _eventViewHtml(event) {
    const status = this._status(event), day = dayOf(event.start,this._zone);
    return `<button type="button" class="ha-view-event ${status !== 'planned' ? 'cancelled' : ''}" data-day="${day}" ${this._colorStyle(event)} aria-label="${esc(`${this._name(event)}, ${this._timeLabel(event.start)}, ${this._statusText(event)}`)}"><span class="ha-view-time">${esc(this._timeLabel(event.start))}</span><strong>${esc(this._name(event))}</strong><span class="ha-secondary">${esc(this._statusText(event))}</span>${this._config.appearance.show_device_names && event.meta?.devices ? `<span>${esc(this._deviceNames(event.meta.devices))}</span>` : ''}</button>`;
  },
  _dayEvents(day) { return this._events.filter(e => e.role === 'group' && dayOf(e.start,this._zone) === day).sort((a,b) => a.start.localeCompare(b.start)); },
  _dayExcluded(day) {
    const from = toInstant(`${day}T00:00`,this._zone), to = toInstant(`${shiftDay(day,1)}T00:00`,this._zone);
    return this._events.some(e => e.role === 'closure' && e.start < to && e.end > from);
  },
  _weekHtml() {
    const first = shiftDay(this._selected,-((weekday(this._selected)-this._config.appearance.first_day+7)%7));
    const format = day => new Intl.DateTimeFormat('fr-BE',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
    return this._viewNavigationHtml(`${format(first)} – ${format(shiftDay(first,6))}`) + `<div class="ha-weekgrid">${visibleWeekdays(this._config.appearance.first_day,this._config.appearance.show_weekends).map(w => {
      const day = shiftDay(first,(w-this._config.appearance.first_day+7)%7), events = this._dayEvents(day), excluded = this._dayExcluded(day);
      return `<section class="ha-weekday ${day === this._selected ? 'selected' : ''}"><button type="button" class="ha-weekday-label" data-day="${day}" aria-pressed="${day === this._selected}">${esc(this._dayLabel(day))}</button>${excluded ? '<span class="ha-badge cancelled">Exclusion</span>' : ''}${events.map(e => this._eventViewHtml(e)).join('')}${!events.length ? '<p class="ha-empty">Aucune programmation</p>' : ''}</section>`;
    }).join('')}</div>`;
  },
  _agendaHtml() {
    const title = new Intl.DateTimeFormat('fr-BE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${this._month}-01T12:00:00Z`));
    const days = [...new Set(this._events.filter(e => e.role === 'group' && dayOf(e.start,this._zone).startsWith(this._month)).map(e => dayOf(e.start,this._zone)))].sort().filter(day => this._config.appearance.show_weekends || ![0,6].includes(weekday(day)));
    return this._viewNavigationHtml(title) + `<div class="ha-agenda">${!days.length ? '<p class="ha-empty">Aucune programmation sur cette période.</p>' : days.map(day => `<section class="ha-agenda-day"><h3>${esc(this._dayLabel(day))}</h3>${this._dayExcluded(day) ? '<span class="ha-badge cancelled">Exclusion</span>' : ''}${this._dayEvents(day).map(e => this._eventViewHtml(e)).join('')}</section>`).join('')}</div>`;
  },
};
