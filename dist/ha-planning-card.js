/* Planning 0.6.1 | Euro-Locks Belgium */
(() => {
'use strict';
const VERSION = "0.6.1";

const MIN_LEAD_MINUTES = 20;
const META_VERSION = 1;
function newEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return `pc-${Array.from(values, n => n.toString(16).padStart(8, '0')).join('')}`;
}
const DEFAULT_GROUPS = [];
const DEFAULT_COLOR = '#3689e6';
function eventColor(value) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : DEFAULT_COLOR; }
function colorText(value) {
  const rgb = eventColor(value).slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#111111' : '#ffffff';
}
function replacesWeekly(restart, weekly) {
  if (restart.meta?.replace_series) return restart.meta.replace_series === weekly.meta?.id;
  return restart.meta?.replace === true || (!Array.isArray(restart.meta?.devices) && restart.start === weekly.start);
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parts(instant, zone) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  return Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
}
function localMinute(instant, zone) {
  const p = parts(instant, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function dayOf(instant, zone) { return localMinute(instant, zone).slice(0, 10); }
function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function weekday(day) { return new Date(`${day}T12:00:00Z`).getUTCDay(); }
function cycleDay(day) { return shiftDay(day, -weekday(day)); }
function toInstant(local, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Date ou heure invalide.');
  const target = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Date ou heure invalide.');
  let candidate = target;
  for (let i = 0; i < 5; i++) {
    const wall = Date.parse(`${localMinute(candidate, zone)}:00Z`);
    if (wall === target) break;
    candidate += target - wall;
  }
  if (localMinute(candidate, zone) !== local) throw new Error('Cette heure n’existe pas dans le fuseau Home Assistant (changement d’heure).');
  if ([candidate - 3600000, candidate + 3600000].some(x => localMinute(x, zone) === local)) {
    throw new Error('Cette heure est ambiguë lors du changement d’heure. Choisissez une autre heure.');
  }
  return new Date(candidate).toISOString();
}
function eventTime(value, zone) {
  if (!value) throw new Error('Événement sans date.');
  if (typeof value === 'object') return eventTime(value.dateTime || value.date, zone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return toInstant(`${value}T00:00`, zone);
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const n = Date.parse(value);
    if (!Number.isFinite(n)) throw new Error('Date de calendrier invalide.');
    return new Date(n).toISOString();
  }
  return toInstant(value.slice(0, 16), zone);
}
function metadata(description) {
  try {
    const value = JSON.parse(description || 'null');
    if (value?.devices !== undefined && (!Array.isArray(value.devices) || value.devices.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)))) return null;
    return value && !Array.isArray(value) && value.planning_chauffe === META_VERSION && ['weekly', 'restart', 'closure'].includes(value.kind) ? value : null;
  } catch { return null; }
}
function normalizeEvent(raw, calendar, role, groupIndex, zone, groups = []) {
  let meta = metadata(raw.description);
  if (role === 'shared') {
    role = meta?.kind === 'closure' ? 'closure' : 'group';
    groupIndex = role === 'closure' ? null : groups.findIndex(g => g.id === (meta?.group || ''));
    if (role === 'group' && groupIndex < 0) meta = null;
  }
  if ((role === 'closure' && meta?.kind !== 'closure') || (role === 'group' && meta?.kind === 'closure')) meta = null;
  return { ...raw, calendar, role, groupIndex, start: eventTime(raw.start, zone), end: eventTime(raw.end, zone), meta, key: `${calendar}|${raw.uid || raw.summary}|${eventTime(raw.start, zone)}` };
}
function sameGroup(a, b) {
  return a.calendar === b.calendar && (a.group ?? a.meta?.group ?? '') === (b.group ?? b.meta?.group ?? '');
}
function isClosed(events, at) {
  const t = Date.parse(at);
  return events.some(e => e.role === 'closure' && Date.parse(e.start) <= t && t < Date.parse(e.end));
}
function eventStatus(event, events, zone) {
  if (event.role === 'closure') return 'closure';
  if (!event.meta || !['weekly', 'restart'].includes(event.meta.kind)) return 'external';
  if (isClosed(events, event.start)) return 'closed';
  if (event.meta.kind === 'weekly') {
    const cycle = cycleDay(dayOf(event.start, zone));
    const replaced = events.some(e => sameGroup(e, event) && e.meta?.kind === 'restart' && replacesWeekly(e, event) && cycleDay(dayOf(e.start, zone)) === cycle);
    if (replaced) return 'replaced';
  }
  return 'planned';
}
function validateConfig(input) {
  const config = { title: 'Planning', demo: !input.calendar, calendar: '', ...input };
  if (config.title === 'Planning de chauffe') config.title = 'Planning';
  config.groups = (input.groups || DEFAULT_GROUPS).map(g => ({ name: String(g.name || '').trim(), calendar: g.calendar || '' }));
  if (input.devices !== undefined && !Array.isArray(input.devices)) throw new Error('La liste des appareils est invalide.');
  config.devices = (input.devices || []).map(d => ({ ...d, id: String(d.id || '').trim(), name: String(d.name || '').trim() }));
  config.appearance = normalizeAppearance(input.appearance);
  if (config.execution_automation && (!/^automation\.[a-z0-9_]+$/.test(config.execution_automation) || !config.calendar)) throw new Error('Choisissez un calendrier unique et une automatisation de gestion des appareils.');
  if (config.devices.some(d => !/^[a-z0-9_]+$/.test(d.id) || !d.name)) throw new Error('Chaque appareil doit avoir un nom et un identifiant (lettres minuscules, chiffres, _).');
  if (new Set(config.devices.map(d => d.id)).size !== config.devices.length) throw new Error('Les identifiants des appareils doivent être distincts.');
  if (config.groups.length > 8) throw new Error('Configurez au maximum 8 groupes.');
  if (!config.demo) {
    const ids = (config.calendar ? [config.calendar] : [config.closure_calendar, ...config.groups.map(g => g.calendar)]).filter(Boolean);
    if (ids.some(x => typeof x !== 'string' || !/^calendar\.[a-z0-9_]+$/.test(x))) throw new Error('Choisissez des entités de type calendrier.');
    if (new Set(ids).size !== ids.length) throw new Error('Chaque groupe et les fermetures doivent utiliser des calendriers distincts.');
  }
  if (config.calendar) {
    const names = config.groups.map(g => g.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) throw new Error('Les groupes doivent avoir des noms distincts.');
  }
  return config;
}
function resolveGroups(config, calendarLabel = '') {
  if (!config.calendar) return config.groups.map(g => ({ ...g, id: '' }));
  const named = config.groups.filter(g => g.name.trim());
  if (!named.length) return [{ name: calendarLabel || 'Calendrier', calendar: config.calendar, id: '' }];
  return named.map(g => ({ ...g, calendar: config.calendar, id: g.name }));
}
function validateDraft(draft, events, zone, now = Date.now(), demo = false, devices) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un libellé à la période d’exclusion.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Cette programmation se trouve pendant une exclusion. Modifiez la date ou l’exclusion.';
  if (draft.color && !/^#[0-9a-f]{6}$/i.test(draft.color)) return 'Choisissez une couleur valide.';
  if (draft.devices !== undefined && (!Array.isArray(draft.devices) || !draft.devices.length || draft.devices.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)) || new Set(draft.devices).size !== draft.devices.length)) return 'Sélectionnez au moins un appareil valide.';
  if (devices && draft.devices?.some(id => !devices.some(device => device.id === id && device.enabled !== false))) return 'Un appareil sélectionné est désactivé ou retiré. Modifiez la sélection.';
  const conflict = events.some(e => {
    if (e.uid === draft.uid || e.calendar !== draft.calendar || !e.meta || !['weekly', 'restart'].includes(e.meta.kind)) return false;
    const draftMeta = { id: draft.event_id, replace_series: draft.replace_series, replace: draft.replace, devices: draft.devices };
    if (sameGroup(e, draft) && (draft.kind === 'restart' && e.meta.kind === 'weekly' && replacesWeekly({start:draft.start, meta:draftMeta}, e)
        || draft.kind === 'weekly' && e.meta.kind === 'restart' && replacesWeekly(e, {start:draft.start, meta:draftMeta}))) return false;
    const sameSlot = draft.kind === 'weekly' && e.meta.kind === 'weekly'
      ? weekday(dayOf(e.start, zone)) === weekday(dayOf(draft.start, zone)) && localMinute(e.start, zone).slice(11) === localMinute(draft.start, zone).slice(11)
      : e.start === draft.start;
    return sameSlot && (Array.isArray(draft.devices) && Array.isArray(e.meta.devices) ? draft.devices.some(id => e.meta.devices.includes(id)) : sameGroup(e, draft));
  });
  if (conflict) return 'Une programmation existe déjà à cette heure pour ces appareils ou ce groupe.';
  return '';
}
function calendarPayload(draft) {
  const event = { dtstart: draft.start, dtend: draft.end, summary: draft.summary.trim(), description: JSON.stringify({ planning_chauffe: META_VERSION, kind: draft.kind, group: draft.kind === 'closure' ? undefined : draft.group, id: draft.event_id, color: draft.color ? eventColor(draft.color) : undefined, devices: draft.kind === 'closure' ? undefined : draft.devices, replace_series: draft.kind === 'restart' ? draft.replace_series || undefined : undefined, replace: draft.kind === 'restart' && draft.replace === true, note: draft.note || '' }) };
  if (draft.kind === 'weekly') event.rrule = draft.rrule;
  return { type: `calendar/event/${draft.uid ? 'update' : 'create'}`, entity_id: draft.calendar, ...(draft.uid ? { uid: draft.uid } : {}), event };
}
function deletionPayload(event) { return { type: 'calendar/event/delete', entity_id: event.calendar, uid: event.uid }; }
function nextWeekly(day, time, zone, now = Date.now()) {
  let date = dayOf(now + MIN_LEAD_MINUTES * 60000, zone);
  date = shiftDay(date, (Number(day) - weekday(date) + 7) % 7);
  let instant = toInstant(`${date}T${time}`, zone);
  if (Date.parse(instant) < now + MIN_LEAD_MINUTES * 60000) instant = toInstant(`${shiftDay(date, 7)}T${time}`, zone);
  return instant;
}
function viewRange(month, firstDay = 1) {
  const first = `${month}-01`, offset = (weekday(first) - firstDay + 7) % 7, start = shiftDay(first, -offset);
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const days = Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(first)) / 86400000);
  const count = Math.ceil((offset + days) / 7) * 7;
  return { start, end: shiftDay(start, count), count, queryStart: shiftDay(start, -7), queryEnd: shiftDay(start, count + 7) };
}
function emptyLocalState(zone, now = Date.now()) {
  return { events: [], selected: dayOf(now, zone) };
}

const DEVICE_REGISTRY_START = '2000-01-01T00:00:00.000Z';
const DEVICE_REGISTRY_END = '2000-01-02T00:00:00.000Z';
const DEVICE_TYPES = { switch: 'Interrupteur / relais', script: 'Script Home Assistant', frech: 'Frech avec contrôle d’entrée' };
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateDevice(device) {
  if (!/^[a-z0-9_]+$/.test(device.id || '')) return 'Identifiant d’appareil invalide.';
  if (typeof device.name !== 'string' || !device.name.trim() || device.name.length > 120) return 'Donnez un nom à l’appareil (120 caractères maximum).';
  if (!Object.hasOwn(DEVICE_TYPES, device.type)) return 'Choisissez le type de démarrage.';
  if (typeof device.enabled !== 'boolean') return 'État d’activation invalide.';
  if (device.type !== 'script' && !/^switch\.[a-z0-9_]+$/.test(device.switch_entity || '')) return 'Choisissez un relais Home Assistant.';
  if (device.type !== 'switch' && !/^script\.[a-z0-9_]+$/.test(device.script_entity || '')) return 'Choisissez un script Home Assistant.';
  if (device.type === 'frech' && (!/^binary_sensor\.[a-z0-9_]+$/.test(device.input_entity || '') || !Number.isInteger(device.frech_number) || device.frech_number < 1 || device.frech_number > 21)) return 'Choisissez l’entrée de contrôle et un numéro Frech entre 1 et 21.';
  return '';
}
function deviceRecord(device) {
  const record = { name: device.name.trim(), type: device.type, enabled: device.enabled };
  if (device.type !== 'script') record.switch_entity = device.switch_entity;
  if (device.type !== 'switch') record.script_entity = device.script_entity;
  if (device.type === 'frech') { record.input_entity = device.input_entity; record.frech_number = device.frech_number; }
  return record;
}
function devicesFromAutomation(config, calendar) {
  if (!/(^|\/)planning-devices\.yaml$/.test(config?.use_blueprint?.path || '')) throw new Error('Choisissez une automatisation créée avec le blueprint Planning — appareils configurables.');
  const input = config.use_blueprint.input || {};
  if (input.planning_calendar !== calendar) throw new Error('La carte et l’automatisation doivent utiliser le même calendrier.');
  const catalog = input.machine_catalog || {};
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Le catalogue de l’automatisation est invalide.');
  return Object.entries(catalog).map(([id, record]) => {
    const device = { ...record, id, name: String(record?.name || id), enabled: record?.enabled === undefined ? true : record.enabled };
    const issue = validateDevice(device);
    if (issue) throw new Error(`${device.name} : ${issue}`);
    return device;
  });
}
function publicDevices(devices) { return devices.map(d => ({ id: d.id, name: d.name, enabled: d.enabled, type: d.type })); }
function registryMetadata(row, automation) {
  try {
    const meta = JSON.parse(row.description || 'null');
    if (meta?.planning_devices !== 1 || meta.automation !== automation || !Array.isArray(meta.devices)) return null;
    if (meta.devices.some(d => !d || !/^[a-z0-9_]+$/.test(d.id || '') || typeof d.name !== 'string' || !d.name.trim() || typeof d.enabled !== 'boolean') || new Set(meta.devices.map(d => d.id)).size !== meta.devices.length) return null;
    return {planning_devices:1,automation,devices:publicDevices(meta.devices)};
  } catch { return null; }
}
function deviceRegistryPayload(calendar, automation, devices, uid) {
  return { type: `calendar/event/${uid ? 'update' : 'create'}`, entity_id: calendar, ...(uid ? { uid } : {}), event: {
    dtstart: DEVICE_REGISTRY_START, dtend: DEVICE_REGISTRY_END, summary: 'Planning — liste des appareils',
    description: JSON.stringify({ planning_devices: 1, automation, devices: publicDevices(devices) }),
  } };
}

// The automation configuration is the authoritative catalogue. HA restricts its
// GET/POST endpoints to administrators. The calendar stores labels only, so
// ordinary users can pick devices without access to technical configuration.
class PlanningDeviceStore {
  constructor(getHass, calendar, automation) { this.getHass = getHass; this.calendar = calendar; this.automation = automation; }
  async registryRows() {
    const query = new URLSearchParams({ start: DEVICE_REGISTRY_START, end: DEVICE_REGISTRY_END });
    const rows = await this.getHass().callApi('GET', `calendars/${this.calendar}?${query}`);
    if (!Array.isArray(rows)) throw new Error('Lecture de la liste des appareils impossible.');
    return rows.filter(row => registryMetadata(row, this.automation));
  }
  configPath() {
    const id = this.getHass().states[this.automation]?.attributes?.id;
    if (!id) throw new Error('Cette automatisation ne possède pas de configuration éditable.');
    return `config/automation/config/${encodeURIComponent(id)}`;
  }
  assertAdminIdle() {
    const hass = this.getHass();
    if (hass.user?.is_admin !== true) throw new Error('La configuration technique est réservée aux administrateurs Home Assistant.');
    const automation = hass.states[this.automation];
    if (!automation || !['on','off'].includes(automation.state)) throw new Error('Automatisation indisponible.');
    if (Number(automation.attributes.current || 0) > 0) throw new Error('Une séquence est en cours. Attendez sa fin pour modifier les appareils.');
  }
  async load() {
    if (this.getHass().user?.is_admin === true) {
      const [config, rows] = await Promise.all([this.getHass().callApi('GET', this.configPath()), this.registryRows()]);
      const devices = devicesFromAutomation(config, this.calendar);
      const expected = stableJson(publicDevices(devices));
      return { config, devices, fingerprint: stableJson(config), needsPublish: !rows.length || rows.some(row => stableJson(registryMetadata(row, this.automation).devices) !== expected) };
    }
    const rows = await this.registryRows();
    const lists = rows.map(row => registryMetadata(row, this.automation).devices);
    if (lists.some(list => stableJson(list) !== stableJson(lists[0]))) throw new Error('La liste partagée des appareils doit être republiée par un administrateur.');
    return { devices: lists[0] || [], needsPublish: !rows.length };
  }
  async publish(devices) {
    this.assertAdminIdle();
    const rows = await this.registryRows();
    const primary = rows[0];
    const expected = stableJson(publicDevices(devices));
    if (!primary || stableJson(registryMetadata(primary, this.automation).devices) !== expected) {
      try { await this.getHass().callWS(deviceRegistryPayload(this.calendar, this.automation, devices, primary?.uid)); }
      catch (error) {
        const fresh = await this.registryRows();
        if (!fresh.some(row => stableJson(registryMetadata(row, this.automation).devices) === expected)) throw error;
      }
    }
    // Repair duplicate display records after simultaneous publications. These
    // records never contain execution entities or parameters.
    for (const duplicate of rows.slice(1)) await this.getHass().callWS({type:'calendar/event/delete',entity_id:this.calendar,uid:duplicate.uid});
  }
  async save(snapshot, devices) {
    this.assertAdminIdle();
    for (const device of devices) { const issue = validateDevice(device); if (issue) throw new Error(issue); }
    if (new Set(devices.map(d => d.id)).size !== devices.length) throw new Error('Les identifiants doivent être distincts.');
    const current = await this.getHass().callApi('GET', this.configPath());
    devicesFromAutomation(current, this.calendar);
    if (stableJson(current) !== snapshot.fingerprint) throw new Error('La configuration a changé depuis son ouverture. Actualisez avant de recommencer.');
    const updated = JSON.parse(JSON.stringify(current));
    updated.use_blueprint.input.machine_catalog = Object.fromEntries(devices.map(device => [device.id, deviceRecord(device)]));
    this.assertAdminIdle();
    try { await this.getHass().callApi('POST', this.configPath(), updated); }
    catch (error) {
      const recovered = await this.getHass().callApi('GET', this.configPath());
      if (stableJson(recovered) !== stableJson(updated)) throw error;
    }
    const confirmed = await this.getHass().callApi('GET', this.configPath());
    if (stableJson(confirmed) !== stableJson(updated)) throw new Error('La sauvegarde de l’automatisation n’a pas pu être confirmée. Actualisez la carte.');
    const result = { config: confirmed, devices: devicesFromAutomation(confirmed, this.calendar), fingerprint: stableJson(confirmed), needsPublish: false };
    try { await this.publish(result.devices); }
    catch { result.needsPublish = true; }
    return result;
  }
}

const DEFAULT_APPEARANCE = { default_view: 'month', first_day: 1, time_format: '24', density: 'comfortable', event_style: 'filled', show_weekends: true, show_device_names: true, accent_color: '' };
function normalizeAppearance(input = {}) {
  const options = { ...DEFAULT_APPEARANCE, ...input };
  for (const [key, choices] of Object.entries({default_view:['month','week','agenda'],first_day:[0,1],time_format:['12','24'],density:['compact','comfortable'],event_style:['filled','outline','dot']})) {
    if (!choices.includes(options[key])) throw new Error(`Réglage d’affichage invalide : ${key}.`);
  }
  for (const key of ['show_weekends','show_device_names']) if (typeof options[key] !== 'boolean') throw new Error(`Réglage d’affichage invalide : ${key}.`);
  if (options.accent_color && !/^#[0-9a-f]{6}$/i.test(options.accent_color)) throw new Error('Couleur d’accent invalide.');
  return options;
}
function visibleWeekdays(firstDay = 1, weekends = true) {
  return Array.from({length:7}, (_, i) => (i + firstDay) % 7).filter(day => weekends || (day !== 0 && day !== 6));
}

const PlanningCalendarViews = {
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




const ACTION_TYPES = {
  switch: {label:'Interrupteur', operations:{on:'Allumer',off:'Éteindre'}},
  light: {label:'Éclairage', operations:{on:'Allumer',off:'Éteindre'}},
  input_boolean: {label:'Commande', operations:{on:'Activer',off:'Désactiver'}},
  cover: {label:'Barrière / volet', operations:{open:'Ouvrir',close:'Fermer',stop:'Arrêter'}},
  script: {label:'Script', operations:{run:'Lancer le script'}},
  scene: {label:'Scène', operations:{run:'Activer la scène'}},
  button: {label:'Bouton', operations:{press:'Appuyer'}},
  input_button: {label:'Bouton', operations:{press:'Appuyer'}},
  frech: {label:'Frech', operations:{start:'Démarrer avec contrôle',off:'Éteindre'}},
};
// UI fixes reuse the already published, unchanged execution blueprint.
const ACTION_BLUEPRINT_VERSION='0.6.0';
function selectedPlanningEntities(input=[]){
  if(!Array.isArray(input) || input.length>200)throw new Error('La sélection doit contenir au maximum 200 entités.');
  for(const entity of input)if(typeof entity!=='string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity) || !Object.hasOwn(ACTION_TYPES,entity.split('.')[0]))throw new Error('Un appareil sélectionné est incompatible.');
  return [...new Set(input)];
}
function targetEntity(record) { return record.entity_id || record.switch_entity || record.script_entity || ''; }
function operationsFor(record) { return ACTION_TYPES[record?.type]?.operations || {}; }
function defaultOperation(record) { return Object.keys(operationsFor(record))[0] || ''; }
function oppositeOperation(op) { return ({on:'off',off:'on',open:'close',close:'open',start:'off'})[op] || ''; }
function simpleActionRecord(entity, name) {
  const type=entity.split('.')[0];
  if (!Object.hasOwn(ACTION_TYPES,type) || type === 'frech' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity)) throw new Error('Choisissez une entité compatible.');
  return {id:`entity_${entity.replace('.','_')}`,name:name || entity,type,entity_id:entity,enabled:true};
}
function validateActionRecord(record) {
  if (!record || !/^[a-z0-9_]+$/.test(record.id || '') || typeof record.name !== 'string' || !record.name.trim() || record.name.length>120 || typeof record.enabled !== 'boolean' || !Object.hasOwn(ACTION_TYPES,record.type)) return 'Action autorisée invalide.';
  if (record.type === 'frech') {
    if (!/^switch\.[a-z0-9_]+$/.test(record.switch_entity || '') || !/^script\.[a-z0-9_]+$/.test(record.script_entity || '') || !/^binary_sensor\.[a-z0-9_]+$/.test(record.input_entity || '') || !Number.isInteger(record.frech_number) || record.frech_number<1 || record.frech_number>21) return 'Configuration du démarrage Frech incomplète.';
  } else if (!new RegExp(`^${record.type}\\.[a-z0-9_]+$`).test(targetEntity(record))) return 'L’entité ne correspond pas au type d’action.';
  return '';
}
function normalizePlanningConfig(input) {
  const config={title:'Planning',calendar:'',demo:!input.calendar,...input,entities:selectedPlanningEntities(input.entities),appearance:normalizeAppearance(input.appearance)};
  if(config.calendar && !/^calendar\.[a-z0-9_]+$/.test(config.calendar)) throw new Error('Choisissez un calendrier Home Assistant.');
  if(config.execution_automation && !/^automation\.[a-z0-9_]+$/.test(config.execution_automation)) throw new Error('Automatisation invalide.');
  delete config.groups; delete config.closure_calendar; delete config.devices;
  return config;
}
function scheduleMetadata(description) {
  try {
    const m=JSON.parse(description || 'null');
    if(m?.planning !== 2 || m.kind !== 'schedule' || typeof m.id !== 'string' || typeof m.has_end !== 'boolean') return null;
    const valid=list=>Array.isArray(list) && list.length<=50 && new Set(list.map(a=>a?.target)).size===list.length && list.every(a=>a && /^[a-z0-9_]+$/.test(a.target || '') && ['on','off','open','close','stop','run','press','start'].includes(a.op));
    if(!valid(m.start_actions) || !m.start_actions.length || !valid(m.end_actions) || (m.has_end !== (m.end_actions.length>0))) return null;
    return m;
  } catch {return null;}
}
function normalizeSchedule(raw,calendar,zone) {
  const meta=scheduleMetadata(raw.description), legacy=meta ? null : metadata(raw.description);
  const start=eventTime(raw.start,zone),end=eventTime(raw.end,zone);
  return {...raw,calendar,start,end,meta,legacy,role:meta?'schedule':legacy?.kind==='closure'?'legacy-closure':legacy?'legacy':'external',key:`${calendar}|${raw.uid || raw.summary}|${raw.recurrence_id || start}`};
}
function recurring(event) {return !!(event.rrule || event.recurrence_id);}
function sameOccurrence(a,b) {return a.calendar===b.calendar && a.uid===b.uid && (a.recurrence_id || '')===(b.recurrence_id || '');}
function occurrenceSelector(event,scope='occurrence') {
  if(!event.uid) throw new Error('Cet événement ne possède pas d’identifiant modifiable.');
  if(scope==='occurrence' && recurring(event)) {
    if(typeof event.recurrence_id !== 'string' || !event.recurrence_id) throw new Error('Ce calendrier ne fournit pas l’identifiant de cette occurrence. La série n’a pas été modifiée.');
    return {uid:event.uid,recurrence_id:event.recurrence_id};
  }
  return {uid:event.uid};
}
function schedulePayload(draft) {
  const event={dtstart:draft.start,dtend:draft.end,summary:draft.summary.trim(),description:JSON.stringify({planning:2,kind:'schedule',id:draft.event_id || newEventId(),color:eventColor(draft.color),has_end:!!draft.has_end,start_actions:draft.start_actions,end_actions:draft.has_end?draft.end_actions:[],note:draft.note || ''})};
  if(draft.rrule && (!draft.uid || draft.scope==='series')) event.rrule=draft.rrule;
  return {type:`calendar/event/${draft.uid?'update':'create'}`,entity_id:draft.calendar,...(draft.uid?occurrenceSelector(draft,draft.scope):{}),event};
}
function occurrenceDeletePayload(event,scope='occurrence') {return {type:'calendar/event/delete',entity_id:event.calendar,...occurrenceSelector(event,scope)};}
function calendarEditPayload(original,changes){
  const event={dtstart:changes.start,dtend:changes.end,summary:changes.summary ?? original.summary,description:changes.description ?? original.description ?? ''};
  if(typeof original.location==='string')event.location=original.location;
  return {type:'calendar/event/update',entity_id:original.calendar,...occurrenceSelector(original),event};
}
function wallDuration(event,zone) {return (Date.parse(`${localMinute(event.end,zone)}:00Z`)-Date.parse(`${localMinute(event.start,zone)}:00Z`))/60000;}
function shiftedOccurrence(event,date,minute,zone) {
  const startWall=`${date}T${minute===undefined?localMinute(event.start,zone).slice(11):`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`}`;
  const duration=wallDuration(event,zone),endWall=new Date(Date.parse(`${startWall}:00Z`)+duration*60000).toISOString().slice(0,16);
  return {start:toInstant(startWall,zone),end:toInstant(endWall,zone)};
}
function activeSlot(event,now=Date.now()) {return !!event.meta?.has_end && Date.parse(event.start)<=now && now<Date.parse(event.end);}
function mutationIssue(event,scope,events,now=Date.now()) {
  if((scope==='series'?events.filter(e=>e.uid===event.uid && e.calendar===event.calendar):[event]).some(e=>activeSlot(e,now))) return 'Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.';
  return '';
}
function validateSchedule(draft,records,now=Date.now(),demo=false) {
  if(!Number.isFinite(Date.parse(draft.start)) || !Number.isFinite(Date.parse(draft.end)) || Date.parse(draft.end)<=Date.parse(draft.start)) return 'La fin doit être après le début.';
  if(!demo && Date.parse(draft.start)<now+MIN_LEAD_MINUTES*60000) return `Prévoyez au moins ${MIN_LEAD_MINUTES} minutes avant le début.`;
  if(!draft.start_actions?.length) return 'Ajoutez au moins une action au début.';
  if(draft.has_end && !draft.end_actions?.length) return 'Choisissez l’action à exécuter à la fin.';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]])if(list.length>50 || new Set(list.map(a=>a.target)).size!==list.length)return 'Choisissez une seule action par appareil à chaque étape (50 maximum).';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]]) for(const a of list) {
    const record=records.find(r=>r.id===a.target);
    if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),a.op)) return 'Une action est absente, désactivée ou incompatible. Vérifiez la sélection.';
  }
  return '';
}
function weeklyStart(date,time,days,zone,now=Date.now(),demo=false) {
  if(!days.length) throw new Error('Choisissez au moins un jour de répétition.');
  for(let offset=0;offset<14;offset++) {
    const day=shiftDay(date,offset);
    if(days.includes(weekday(day))) {const instant=toInstant(`${day}T${time}`,zone);if(demo || Date.parse(instant)>=now+MIN_LEAD_MINUTES*60000) return instant;}
  }
  throw new Error('Choisissez une date de début future.');
}
function scheduleFingerprint(event) {return JSON.stringify([event.summary,event.description || '',event.start,event.end,event.rrule || '',event.recurrence_id || '']);}
function matchesSavedSchedule(event,draft) {
  const payload=schedulePayload(draft).event;
  return event.uid===draft.uid && event.start===draft.start && event.end===draft.end && event.summary===payload.summary && JSON.stringify(scheduleMetadata(event.description))===JSON.stringify(scheduleMetadata(payload.description));
}
function packWeekEvents(events,zone,pixelsPerHour=48) {
  const placed=[];
  for(const event of [...events].sort((a,b)=>a.start.localeCompare(b.start))) {
    const time=localMinute(event.start,zone).slice(11),minute=Number(time.slice(0,2))*60+Number(time.slice(3));
    const end=Math.max(minute+35*60/pixelsPerHour,minute+(event.meta?.has_end?Math.max(5,wallDuration(event,zone)):5));
    let lane=0;while(placed.some(p=>p.lane===lane && p.minute<end && minute<p.visualEnd))lane++;
    placed.push({event,minute,visualEnd:Math.min(1440,end),lane});
  }
  const count=Math.max(1,...placed.map(p=>p.lane+1));return placed.map(p=>({...p,lanes:count}));
}




function actionCatalog(config,calendar) {
  if(!/(^|\/)planning-actions\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar) throw new Error('Choisissez l’exécution Planning de ce calendrier.');
  const raw=config.use_blueprint.input.action_catalog || {};
  if(typeof raw!=='object' || Array.isArray(raw)) throw new Error('La liste des actions autorisées est invalide.');
  return Object.entries(raw).map(([id,r])=>{const record={...r,id,name:r.name || id,enabled:r.enabled===undefined?true:r.enabled};const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;});
}
function publicActionCatalog(records) {return records.map(r=>({id:r.id,name:r.name,type:r.type,entity_id:targetEntity(r),enabled:r.enabled}));}
function importedActionCatalog(config,calendar){
  if(!/(^|\/)planning-(devices|frech)\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar)return [];
  return Object.entries(config.use_blueprint.input.machine_catalog || {}).map(([id,r])=>{
    const type=r.type || 'frech',record={...r,id,type,name:r.name || `Frech ${r.frech_number || id}`,enabled:r.enabled!==false};
    if(type==='switch')record.entity_id=r.switch_entity;if(type==='script')record.entity_id=r.script_entity;
    if(type==='frech' && !record.script_entity)record.script_entity=config.use_blueprint.input.startup_script;
    const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;
  });
}
function actionRegistry(row) {
  try {
    const m=JSON.parse(row.description || 'null');
    if(m?.planning_actions!==1 || !/^automation\.[a-z0-9_]+$/.test(m.automation || '') || !Array.isArray(m.actions))return null;
    if(m.actions.some(r=>!r || !/^[a-z0-9_]+$/.test(r.id || '') || typeof r.name!=='string' || typeof r.enabled!=='boolean' || !/^[a-z_]+\.[a-z0-9_]+$/.test(r.entity_id || '')))return null;
    return {automation:m.automation,test_mode:m.test_mode!==false,actions:publicActionCatalog(m.actions)};
  }catch{return null;}
}
class PlanningActionStore {
  constructor(getHass,calendar,automation='') {this.getHass=getHass;this.calendar=calendar;this.automation=automation;}
  async registryRows() {
    const q=new URLSearchParams({start:DEVICE_REGISTRY_START,end:DEVICE_REGISTRY_END});
    const rows=await this.getHass().callApi('GET',`calendars/${this.calendar}?${q}`);
    if(!Array.isArray(rows))throw new Error('La configuration du planning est indisponible.');
    return rows.filter(row=>actionRegistry(row));
  }
  configPath() {const id=this.getHass().states[this.automation]?.attributes?.id || (this._createdState?.entity_id===this.automation?this._createdState.attributes.id:null);if(!id)throw new Error('Exécution du planning indisponible.');return `config/automation/config/${encodeURIComponent(id)}`;}
  assertAdminIdle() {
    if(this.getHass().user?.is_admin!==true)throw new Error('Un administrateur doit autoriser cette nouvelle entité une première fois.');
    if(Number(this.getHass().states[this.automation]?.attributes?.current || 0)>0)throw new Error('Une action est en cours. Attendez sa fin pour ajouter une nouvelle entité.');
  }
  async load() {
    const rows=await this.registryRows(), links=[...new Set(rows.map(r=>actionRegistry(r).automation))];
    if(links.length>1)throw new Error('Plusieurs exécutions sont associées à ce calendrier. Vérifiez la configuration.');
    if(links.length)this.automation=links[0];
    if(!this.automation)return {ready:false,records:[],test_mode:true};
    if(this.getHass().user?.is_admin===true) {
      const config=await this.getHass().callApi('GET',this.configPath());
      try {const records=actionCatalog(config,this.calendar),test_mode=config.use_blueprint.input.test_mode!==false;const expected={automation:this.automation,test_mode,actions:publicActionCatalog(records)};return {ready:true,config,records,fingerprint:stableJson(config),test_mode,needsPublish:rows.length!==1 || stableJson(actionRegistry(rows[0]))!==stableJson(expected)};}
      catch(error){if(!links.length)return {ready:false,records:importedActionCatalog(config,this.calendar),test_mode:true,legacy_automation:this.automation};throw error;}
    }
    if(!rows.length)return {ready:false,records:[],test_mode:true};
    const meta=actionRegistry(rows[0]);
    if(rows.some(r=>stableJson(actionRegistry(r))!==stableJson(meta)))throw new Error('Un administrateur doit actualiser la liste des actions autorisées.');
    return {ready:true,records:meta.actions,test_mode:meta.test_mode};
  }
  async publish(snapshot) {
    this.assertAdminIdle();
    const rows=await this.registryRows(), same=rows.filter(r=>actionRegistry(r).automation===this.automation);
    const description=JSON.stringify({planning_actions:1,automation:this.automation,test_mode:snapshot.test_mode,actions:publicActionCatalog(snapshot.records)});
    const payload={type:`calendar/event/${same[0]?'update':'create'}`,entity_id:this.calendar,...(same[0]?{uid:same[0].uid}:{}),event:{dtstart:DEVICE_REGISTRY_START,dtend:DEVICE_REGISTRY_END,summary:'Planning — configuration',description}};
    if(!same[0] || same[0].description!==description) {
      try{await this.getHass().callWS(payload);}catch(error){const fresh=await this.registryRows();if(!fresh.some(r=>r.description===description))throw error;}
    }
    for(const duplicate of same.slice(1))await this.getHass().callWS({type:'calendar/event/delete',entity_id:this.calendar,uid:duplicate.uid});
  }
  async save(snapshot,records) {
    this.assertAdminIdle();for(const r of records){const issue=validateActionRecord(r);if(issue)throw new Error(issue);}
    const current=await this.getHass().callApi('GET',this.configPath());actionCatalog(current,this.calendar);
    if(stableJson(current)!==snapshot.fingerprint)throw new Error('Les actions autorisées ont changé. Actualisez puis vérifiez votre programmation.');
    const updated=JSON.parse(JSON.stringify(current));updated.use_blueprint.input.action_catalog=Object.fromEntries(records.map(({id,...r})=>[id,r]));
    this.assertAdminIdle();
    try{await this.getHass().callApi('POST',this.configPath(),updated);}catch(error){const recovered=await this.getHass().callApi('GET',this.configPath());if(stableJson(recovered)!==stableJson(updated))throw error;}
    const confirmed=await this.getHass().callApi('GET',this.configPath());if(stableJson(confirmed)!==stableJson(updated))throw new Error('La sauvegarde des actions n’a pas pu être confirmée.');
    const result={ready:true,config:confirmed,records:actionCatalog(confirmed,this.calendar),fingerprint:stableJson(confirmed),test_mode:confirmed.use_blueprint.input.test_mode!==false};
    try{await this.publish(result);}catch{result.needsPublish=true;}return result;
  }
  async prepare(snapshot,rows) {
    const fresh=await this.load();if(!fresh.ready)throw new Error('Préparez d’abord l’exécution de ce calendrier dans les réglages de la carte.');
    const records=[...fresh.records], resolved=[];let added=false;
    for(const row of rows) {
      let record=records.find(r=>r.id===row.target);
      if(!record && row.target?.startsWith('entity:')) {
        this.assertAdminIdle();const entity=row.target.slice(7), state=this.getHass().states[entity];if(!state)throw new Error('Cette entité n’est plus disponible.');
        record=records.find(r=>targetEntity(r)===entity);
        if(!record){record=simpleActionRecord(entity,state.attributes?.friendly_name || entity);if(records.some(r=>r.id===record.id))throw new Error('Identifiant d’action déjà utilisé.');records.push(record);added=true;}
      }
      if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),row.op))throw new Error('Choisissez une action active et compatible.');
      const old=snapshot?.records.find(r=>r.id===record.id);
      if(old && snapshot.config && stableJson(old)!==stableJson(record))throw new Error('Cette action a changé depuis l’ouverture. Actualisez et recommencez.');
      resolved.push({target:record.id,op:row.op});
    }
    const saved=added?await this.save(fresh,records):fresh;return {snapshot:saved,actions:resolved};
  }
  async setup(version,legacyAutomation='') {
    if(!/^calendar\.[a-z0-9_]+$/.test(this.calendar || ''))throw new Error('Choisissez d’abord un calendrier local dans la configuration de la carte.');
    if(this.getHass().user?.is_admin!==true)throw new Error('La préparation du planning nécessite un administrateur Home Assistant.');
    const installed=await this.getHass().callWS({type:'blueprint/list',domain:'automation'});
    let path=Object.keys(installed).find(p=>/(^|\/)planning-actions\.yaml$/.test(p) && installed[p].metadata?.source_url?.startsWith('https://github.com/Euro-Locks-Belgium/ha-planning-card/'));
    if(!path) {
      if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Version de développement : importer manuellement le blueprint planning-actions.yaml pour tester dans Home Assistant.');
      const url=`https://github.com/Euro-Locks-Belgium/ha-planning-card/blob/v${version}/blueprints/planning-actions.yaml`;
      const imported=await this.getHass().callWS({type:'blueprint/import',url});
      if(imported.validation_errors && Object.keys(imported.validation_errors).length)throw new Error('Le blueprint téléchargé n’a pas été validé.');
      if(imported.exists)throw new Error('Un blueprint du même nom existe déjà. Vérifiez-le dans Home Assistant.');
      if(!/^[a-zA-Z0-9/_-]+$/.test(imported.suggested_filename || '') || !imported.suggested_filename.endsWith('planning-actions'))throw new Error('Nom du blueprint inattendu.');
      path=`${imported.suggested_filename}.yaml`;
      await this.getHass().callWS({type:'blueprint/save',domain:'automation',path,yaml:imported.raw_data,source_url:url});
    }
    const id=`planning_actions_${this.calendar.slice(9)}`, endpoint=`config/automation/config/${id}`;
    let config;
    try{config=await this.getHass().callApi('GET',endpoint);actionCatalog(config,this.calendar);}
    catch(error){
      if(![error.status_code,error.status].includes(404))throw error;
      let catalog={};
      if(legacyAutomation && this.getHass().states[legacyAutomation]?.attributes?.id) {
        const old=await this.getHass().callApi('GET',`config/automation/config/${encodeURIComponent(this.getHass().states[legacyAutomation].attributes.id)}`);
        if(/(^|\/)planning-(devices|frech)\.yaml$/.test(old.use_blueprint?.path || '') && old.use_blueprint.input?.planning_calendar===this.calendar) {
          catalog=Object.fromEntries(importedActionCatalog(old,this.calendar).map(({id,...r})=>[id,r]));
        }
      }
      config={id,alias:`Planning — ${this.getHass().states[this.calendar]?.attributes?.friendly_name || this.calendar}`,use_blueprint:{path,input:{planning_calendar:this.calendar,action_catalog:catalog,test_mode:true}}};
      try{await this.getHass().callApi('POST',endpoint,config);}catch(error){const read=await this.getHass().callApi('GET',endpoint);if(stableJson(read)!==stableJson(config))throw error;}
    }
    for(let attempt=0;attempt<8;attempt++) {
      const states=await this.getHass().callWS({type:'get_states'}), state=states.find(s=>s.entity_id.startsWith('automation.') && s.attributes?.id===id);
      if(state){this.automation=state.entity_id;this._createdState=state;const snapshot={ready:true,config,records:actionCatalog(config,this.calendar),fingerprint:stableJson(config),test_mode:config.use_blueprint.input.test_mode!==false};await this.publish(snapshot);return snapshot;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('L’automatisation est enregistrée. Actualisez la carte lorsque Home Assistant a terminé son chargement.');
  }
}

const BASE_PLANNING_STYLE = `
:host{display:block;font-family:var(--paper-font-body1_-_font-family,Arial,sans-serif);color:var(--primary-text-color,#e7eaef)}*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--card-background-color,#202226));border-radius:var(--ha-card-border-radius,16px);overflow:hidden}main{padding:20px;--accent:var(--primary-color,#31b8de)}h1{font-size:24px;margin:0}h2{font-size:18px;margin:0}h3{font-size:16px;margin:14px 0}p{line-height:1.5}.muted,small{color:var(--secondary-text-color,#aeb7c1)}small{font-size:12px}.toolbar,.row,.tabs,.buttons{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.toolbar{justify-content:space-between;margin-bottom:15px}.tabs{margin:15px 0}.tabs button[aria-pressed=true]{background:var(--accent);color:#071c25}.status{padding:10px 12px;background:var(--secondary-background-color,#292e34);border-radius:9px;font-size:13px;margin:12px 0}.error{border:1px solid #f38181;color:#ffb6b6}.notice{border-left:3px solid var(--accent)}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;border:1px solid var(--divider-color,#424850);background:transparent;border-radius:8px;padding:9px 12px}button:hover{background:var(--secondary-background-color,#30363d)}button.primary{background:var(--accent);color:#07222c;border-color:transparent;font-weight:600}button.danger{color:#ff8585}button:disabled{opacity:.45;cursor:default}input,select,textarea{width:100%;background:var(--secondary-background-color,#292e34);border:1px solid var(--divider-color,#444a52);border-radius:7px;padding:10px;min-width:0}option{background:var(--card-background-color,#202226);color:var(--primary-text-color,#e7eaef)}label{display:flex;flex-direction:column;gap:6px;font-size:14px;min-width:0}.field{margin:15px 0}.check{flex-direction:row;align-items:center}.check input{width:auto}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:15px}.time{display:flex;align-items:center;gap:5px}.time select{width:auto;min-width:68px}.weekdays{display:flex;flex-wrap:wrap;gap:6px}.weekdays label{padding:8px;border:1px solid var(--divider-color,#444);border-radius:7px}.weekdays input{width:auto}form,.panel{margin-top:18px;padding:18px;border:1px solid var(--divider-color,#41474e);border-radius:12px}.action-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(100px,.65fr) auto;gap:8px;margin:9px 0}.action-row button{padding:6px 10px}.calendar{display:grid;grid-template-columns:repeat(var(--columns,7),minmax(0,1fr));border-top:1px solid var(--divider-color,#3c4148);border-left:1px solid var(--divider-color,#3c4148)}.weekday{text-align:center;padding:9px 0;font-size:12px;font-weight:600}.day{min-height:108px;padding:5px;border-right:1px solid var(--divider-color,#3c4148);border-bottom:1px solid var(--divider-color,#3c4148);min-width:0}.day.outside{opacity:.6}.day.selected{background:color-mix(in srgb,var(--accent) 8%,transparent)}.date{padding:3px 6px;border:0;font-size:12px}.event{display:block;text-align:left;width:100%;padding:6px;margin:4px 0;border:0;border-left:3px solid var(--event);background:var(--event);color:var(--event-text);border-radius:5px;font-size:12px;overflow:hidden;overflow-wrap:anywhere;touch-action:pan-y}.event span,.event strong{display:block}.event[draggable=true]{cursor:grab}.event:active{cursor:grabbing}.event small{color:inherit;opacity:.85}.event.external{background:var(--secondary-background-color,#30343a);color:inherit;border:1px dashed #7f8995}.drop-over{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 15%,transparent)}.agenda{display:grid;gap:10px}.agenda-item{display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:start}.week-scroll{overflow:auto;max-height:680px;border:1px solid var(--divider-color,#41474e);border-radius:8px}.week{display:grid;grid-template-columns:48px repeat(var(--columns,7),minmax(94px,1fr));min-width:700px}.week-head{position:sticky;top:0;z-index:3;padding:10px 4px;text-align:center;background:var(--card-background-color,#202226);font-size:12px;border-bottom:1px solid #444}.hours,.week-day{height:1152px;position:relative}.hours span{position:absolute;left:5px;font-size:10px;color:var(--secondary-text-color,#aaa)}.week-day{border-left:1px solid var(--divider-color,#41474e);background:repeating-linear-gradient(to bottom,transparent 0,transparent 47px,var(--divider-color,#41474e) 47px,var(--divider-color,#41474e) 48px)}.week-day .event{position:absolute;margin:0;min-height:32px;z-index:1}.week-day .event:hover{z-index:2}.day-list{margin-top:15px}.hint{font-size:12px;color:var(--secondary-text-color,#adb5bf)}[data-density=compact] .day{min-height:80px}[data-density=compact] .event{padding:4px}[data-event-style=outline] .event:not(.external){background:transparent;border:1px solid var(--event);border-left:4px solid var(--event);color:var(--primary-text-color,#eee)}[data-event-style=dot] .event:not(.external){background:transparent;color:var(--primary-text-color,#eee);border-left:5px solid var(--event)}details{margin-top:15px}summary{cursor:pointer}input[type=color]{width:70px;height:42px;padding:4px}.empty{text-align:center;padding:25px;color:var(--secondary-text-color,#aaa)}@media(max-width:600px){main{padding:12px}.toolbar{gap:8px}h1{font-size:21px}.calendar .day{min-height:80px;padding:2px}.event{font-size:10px;padding:4px}.grid2{grid-template-columns:1fr}.action-row{grid-template-columns:minmax(100px,1fr) minmax(90px,.7fr) auto;gap:5px}.action-row select{padding:8px 4px;font-size:12px}.agenda-item{grid-template-columns:85px 1fr}form,.panel{padding:12px}.date{padding:3px}.toolbar button{padding:7px 9px}}
`;
const PLANNING_STYLE=BASE_PLANNING_STYLE+`:host{height:100%}ha-card{height:100%;overflow:auto}main{min-height:100%;display:flex;flex-direction:column}.calendar{flex:1;grid-template-rows:28px repeat(var(--weeks,5),minmax(80px,1fr))}.event:hover{background:var(--event);filter:brightness(1.1)}.calendar .event strong{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.calendar .event span,.calendar .event small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:600px){.calendar .event small{display:none}.calendar .event strong{-webkit-line-clamp:1}}`;

const PlanningInteractions={
  _installInteractions(){
    const root=this.shadowRoot;
    root.addEventListener('cancel',e=>{e.preventDefault();if(!this._busy)this._closeOverlay();},true);
    root.addEventListener('pointerdown',e=>this._pointerDown(e));
    root.addEventListener('pointermove',e=>this._pointerMove(e));
    root.addEventListener('pointerup',e=>this._pointerEnd(e));
    root.addEventListener('pointercancel',()=>this._clearPointer());
    root.addEventListener('lostpointercapture',e=>{const p=this._pointer;if(p?.active && e.target===p.source && !p.source.hasPointerCapture(p.id))this._clearPointer();});
    root.addEventListener('dragstart',e=>{
      if(this._pointer?.active){e.preventDefault();e.stopPropagation();return;}
      const el=e.target.closest('[data-event]'),item=this._events.find(x=>x.key===el?.dataset.event);
      if(!item?.uid || this._busy){e.preventDefault();return;}
      e.stopPropagation();this._dragKey=item.key;e.dataTransfer.setData('text/plain',item.key);e.dataTransfer.effectAllowed='move';
    });
    root.addEventListener('dragover',e=>{if(!this._dragKey)return;const drop=this._dropAt(e.clientX,e.clientY);if(drop){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';this._highlightDrop(drop);}});
    root.addEventListener('dragend',()=>{this._dragKey=null;this._highlightDrop(null);});
    root.addEventListener('drop',e=>{if(!this._dragKey)return;e.preventDefault();e.stopPropagation();const item=this._events.find(x=>x.key===this._dragKey),drop=this._dropAt(e.clientX,e.clientY);this._dragKey=null;this._highlightDrop(null);if(item && drop)this._move(item,drop.day,drop.minute);});
  },
  _dropAt(x,y){
    if(this._draft || this._settings || this._deviceDraft)return null;
    const target=this.shadowRoot.elementFromPoint(x,y)?.closest('[data-drop]');if(!target)return null;
    // elementFromPoint can find an element behind its scroll container in some browsers.
    const clip=target.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card'),bounds=clip.getBoundingClientRect();
    if(x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)return null;
    let minute;if(target.classList.contains('week-day'))minute=Math.max(0,Math.min(1430,Math.round((y-target.getBoundingClientRect().top)/48*6)*10));
    return {element:target,day:target.dataset.drop,minute};
  },
  _highlightDrop(drop){this.shadowRoot.querySelectorAll('.drop-over').forEach(x=>x.classList.remove('drop-over'));drop?.element.classList.add('drop-over');},
  _pointerDown(e){
    this._suppressEventClickUntil=0;
    const el=e.target.closest('[data-event]');if(!el || this._busy || e.button!==0 || !e.isPrimary)return;
    const handle=!!e.target.closest('[data-move-handle]');if(e.pointerType!=='mouse' && !handle)return;
    const item=this._events.find(x=>x.key===el.dataset.event);if(!item?.uid)return;
    e.stopPropagation();if(handle)e.preventDefault();
    this._pointer={id:e.pointerId,key:item.key,item,source:el,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,active:false};
  },
  _pointerMove(e){
    const p=this._pointer;if(!p || p.id!==e.pointerId)return;p.lastX=e.clientX;p.lastY=e.clientY;
    if(!p.active && Math.hypot(e.clientX-p.x,e.clientY-p.y)<7)return;
    e.preventDefault();e.stopPropagation();
    if(!p.active){
      p.active=true;p.source.setPointerCapture(e.pointerId);p.source.classList.add('drag-source');
      const ghost=document.createElement('div');ghost.className='planning-drag-preview';ghost.textContent=p.item.summary;
      Object.assign(ghost.style,{position:'fixed',zIndex:'2147483647',pointerEvents:'none',padding:'10px 14px',borderRadius:'8px',background:'#172b3d',color:'#fff',boxShadow:'0 6px 30px #0008',font:'14px Arial,sans-serif',maxWidth:'280px'});document.body.append(ghost);p.ghost=ghost;
      p.abort=new AbortController();document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();this._clearPointer();}},{capture:true,signal:p.abort.signal});
      const tick=()=>{if(this._pointer!==p || !p.active)return;this._dragScroll(p);this._updatePointerDrop(p);p.frame=requestAnimationFrame(tick);};p.frame=requestAnimationFrame(tick);
    }
    this._updatePointerDrop(p);
  },
  _updatePointerDrop(p){
    p.drop=this._dropAt(p.lastX,p.lastY);this._highlightDrop(p.drop);
    if(p.ghost){p.ghost.style.left=`${Math.max(4,Math.min(innerWidth-285,p.lastX+14))}px`;p.ghost.style.top=`${Math.max(4,Math.min(innerHeight-70,p.lastY+14))}px`;p.ghost.textContent=`${p.item.summary} · ${p.drop?this._label(p.drop.day)+(p.drop.minute===undefined?'':` ${String(Math.floor(p.drop.minute/60)).padStart(2,'0')}:${String(p.drop.minute%60).padStart(2,'0')}`):'Choisir une date'}`;}
  },
  _dragScroll(p){
    const near=this.shadowRoot.elementFromPoint(p.lastX,p.lastY),box=near?.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card');
    if(!box)return;const r=box.getBoundingClientRect(),edge=38;
    if(p.lastX>=r.left && p.lastX<=r.right){if(p.lastY<Math.max(0,r.top)+edge)box.scrollTop-=9;else if(p.lastY>Math.min(innerHeight,r.bottom)-edge)box.scrollTop+=9;}
    if(box.classList.contains('week-scroll')){if(p.lastX<r.left+edge)box.scrollLeft-=9;else if(p.lastX>r.right-edge)box.scrollLeft+=9;}
  },
  _pointerEnd(e){
    const p=this._pointer;if(!p || e.pointerId!==p.id)return;
    if(!p.active){this._clearPointer();return;}
    e.preventDefault();e.stopPropagation();this._updatePointerDrop(p);const {item,drop}=p;this._suppressEventClickUntil=performance.now()+400;this._clearPointer();
    if(drop)this._move(item,drop.day,drop.minute);
  },
  _clearPointer(){
    const p=this._pointer;this._pointer=null;if(!p)return;cancelAnimationFrame(p.frame);p.abort?.abort();p.ghost?.remove();p.source.classList.remove('drag-source');
    if(p.source.hasPointerCapture?.(p.id))p.source.releasePointerCapture(p.id);this._highlightDrop(null);
  },
  _rememberDialog(){
    const dialog=this.shadowRoot.querySelector('dialog[open]'),active=this.shadowRoot.activeElement;
    if(!dialog)return null;let selector='';
    if(active?.name)selector=`[name="${CSS.escape(active.name)}"]`;
    else if(active?.dataset.deviceField)selector=`[data-device-field="${CSS.escape(active.dataset.deviceField)}"]`;
    else if(active?.closest('.action-row')){const row=active.closest('.action-row');selector=`[data-phase="${row.dataset.phase}"][data-index="${row.dataset.index}"] [${active.hasAttribute('data-target')?'data-target':'data-operation'}]`;}
    else if(active?.dataset.action)selector=`[data-action="${CSS.escape(active.dataset.action)}"]`;
    return {scroll:dialog.scrollTop,selector,start:active?.selectionStart,end:active?.selectionEnd};
  },
  _restoreDialog(state){
    const dialog=this.shadowRoot.querySelector('dialog');
    if(dialog && this.isConnected){
      dialog.showModal();dialog.addEventListener('click',e=>{if(e.target!==dialog || this._busy)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)this._closeOverlay();});
      const focus=state?.selector?dialog.querySelector(state.selector):null;
      (focus || dialog.querySelector('h2'))?.focus({preventScroll:true});
      if(focus && typeof state.start==='number' && ['INPUT','TEXTAREA'].includes(focus.tagName)){try{focus.setSelectionRange(state.start,state.end);}catch{/* Select/date/color inputs have no text selection. */}}
      dialog.scrollTop=state?.scroll || 0;
    }
    if(!dialog && state)this.shadowRoot.querySelector('[data-action=new]')?.focus({preventScroll:true});
    this._showToast();
  },
  _closeOverlay(){if(this._busy)return;this._draft=null;this._settings=false;this._deviceDraft=null;this._error='';this._render();},
  _showToast(){
    const toast=this.shadowRoot.querySelector('.planning-toast');if(!toast)return;
    if(toast.showPopover)toast.showPopover();clearTimeout(this._toastTimer);
    this._toastTimer=setTimeout(()=>{if(this._error)return;toast.remove();},6000);
  },
};
const INTERACTION_STYLE=`
dialog.planning-dialog{position:fixed;inset:0;margin:auto;width:min(760px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);overflow:auto;padding:0;background:var(--ha-card-background,var(--card-background-color,#202226));color:var(--primary-text-color,#e7eaef);border:1px solid var(--divider-color,#41474e);border-radius:16px;box-shadow:0 24px 90px #0008;overscroll-behavior:contain;--accent:var(--primary-color,#31b8de)}dialog.planning-dialog::backdrop{background:#0009}dialog .dialog-body{padding:20px}dialog form,dialog .panel{margin:0;border:0;padding:0}dialog h2{outline:none}dialog .toolbar:first-child{position:sticky;top:-20px;background:var(--card-background-color,#202226);padding:12px 0;z-index:2}dialog .error{white-space:normal}.event{position:relative;padding-right:23px}.event-handle{position:absolute;right:1px;top:2px;width:22px;min-height:30px;padding:3px 0;border:0;border-radius:4px;background:transparent;color:inherit;touch-action:none;cursor:grab;user-select:none}.event-handle:hover{background:#ffffff35}.drag-source{opacity:.4}.planning-toast{position:fixed;inset:16px auto auto 50%;transform:translateX(-50%);margin:0;width:max-content;max-width:calc(100vw - 32px);padding:12px 40px 12px 15px;z-index:2147483647;border:1px solid var(--divider-color,#526271);border-radius:10px;background:var(--card-background-color,#202b36);color:var(--primary-text-color,#fff);box-shadow:0 5px 30px #0006;font-size:14px}.planning-toast.error{border-color:#e48a8a}.planning-toast button{position:absolute;right:5px;top:4px;border:0;padding:4px 7px}.planning-toast::backdrop{background:transparent}.event-main{display:block;width:100%;padding:0;border:0;text-align:left;background:transparent!important;color:inherit;font:inherit;cursor:pointer;overflow:hidden}.event[draggable=true]{user-select:none}@media(max-width:600px){dialog.planning-dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:12px}dialog .dialog-body{padding:14px}.event-handle{width:21px}.event{padding-right:21px}dialog .toolbar:first-child{top:-14px}}`;




const PlanningDeviceSettings={
  _deviceSettingsHtml(){
    const admin=this._config.demo || this._hass.user?.is_admin===true;
    return `<h3>Appareils du planning</h3><p class="hint">Ajoutez ici vos appareils une fois. Ils seront ensuite proposés dans chaque programmation.</p>${this._snapshot.records.length?`<div class="device-list">${this._snapshot.records.map(r=>`<div class="device-item"><div><strong>${esc(r.name)}</strong><small>${esc(ACTION_TYPES[r.type]?.label || r.type)} · ${r.enabled===false?'Désactivé':'Disponible'}</small></div>${admin?this._button('Modifier','edit-device',`data-device-id="${r.id}"`):''}</div>`).join('')}</div>`:'<p>Aucun appareil enregistré pour le moment.</p>'}${admin?this._button('+ Ajouter un appareil','new-device','class="primary"'):'<p class="hint">Un administrateur ajoute les nouveaux appareils. Vous pouvez modifier les horaires et les actions des appareils disponibles.</p>'}`;
  },
  _entityOptions(domain,value=''){
    const list=Object.values(this._hass.states || {}).filter(s=>s.entity_id.startsWith(domain+'.')).sort((a,b)=>(a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id,'fr'));
    return `<option value="">Choisir une entité</option>${list.map(s=>`<option value="${s.entity_id}" ${s.entity_id===value?'selected':''}>${esc(s.attributes?.friendly_name || s.entity_id)} — ${s.entity_id}</option>`).join('')}${value && !list.some(s=>s.entity_id===value)?`<option selected value="${esc(value)}">${esc(value)} (indisponible)</option>`:''}`;
  },
  _deviceFormHtml(){
    const d=this._deviceDraft;
    const entity=(label,field,domain)=>`<label class="field">${label}<select data-device-field="${field}">${this._entityOptions(domain,d[field])}</select></label>`;
    return `<form data-device-form><div class="toolbar"><h2 tabindex="-1">${d.id?'Modifier un appareil':'Ajouter un appareil'}</h2>${this._button('Fermer','device-cancel')}</div><label class="field">Nom affiché<input data-device-field="name" maxlength="120" value="${esc(d.name)}" placeholder="Nom de l’appareil"></label><label class="field">Type<select data-device-field="type">${Object.entries(ACTION_TYPES).map(([key,r])=>`<option value="${key}" ${d.type===key?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>${d.type==='frech'?`${entity('Relais de la Frech','switch_entity','switch')}${entity('Entrée de contrôle','input_entity','binary_sensor')}${entity('Script de démarrage existant','script_entity','script')}<label class="field">Numéro de la Frech<input type="number" min="1" max="21" step="1" data-device-field="frech_number" value="${d.frech_number || ''}"></label><p class="hint">Le script existant est conservé avec son relais, son entrée et son numéro. Le planning propose un démarrage seul.</p>`:entity('Appareil / entité','entity_id',d.type)}<label class="check field"><input type="checkbox" data-device-field="enabled" ${d.enabled?'checked':''}>Disponible dans les programmations</label><div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>Enregistrer l’appareil</button>${this._button('Annuler','device-cancel')}</div></form>`;
  },
  _openDevice(id=''){
    if(!this._config.demo && this._hass.user?.is_admin!==true)return;
    const record=this._snapshot.records.find(r=>r.id===id);this._deviceSnapshot=structuredClone(this._snapshot);this._deviceDraft=record?structuredClone(record):{name:'',type:'switch',entity_id:'',switch_entity:'',script_entity:'',input_entity:'',frech_number:1,enabled:true};this._error='';this._notice='';this._render();
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
      if(!d.id && this._deviceSnapshot.records.some(r=>r.id===id || targetEntity(r)===entity))throw new Error('Cet appareil est déjà présent. Utilisez Modifier dans la liste.');
      if(old && stableJson({...old,name:''})!==stableJson({...record,name:''})){const today=dayOf(Date.now(),this._zone),events=this._config.demo?this._events:await this._fetch(shiftDay(today,-1),shiftDay(today,2));for(const event of events){if([...event.meta?.start_actions || [],...event.meta?.end_actions || []].some(a=>a.target===id)){const active=mutationIssue(event,'occurrence',events);if(active)throw new Error(active);}}}
      if(this._config.demo){const records=this._snapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot={...this._snapshot,records};}
      else{if(!this._snapshot.ready){this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);this._deviceSnapshot=this._snapshot;}const records=this._deviceSnapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot=await this._store.save(this._deviceSnapshot,records);}
      this._deviceDraft=null;this._settings=true;this._notice='Appareil enregistré.';if(this._config.entities?.length && !this._config.entities.includes(entity))this._notice+=' Pour le proposer sur cette carte, cochez-le dans Modifier la carte → Appareils proposés dans les programmations.';else this._notice+=' Il est disponible dans les programmations.';
    }catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  },
};
const DEVICE_SETTINGS_STYLE=`.device-list{display:grid;gap:8px;margin:14px 0}.device-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--divider-color,#41474e);border-radius:8px}.device-item small{display:block;margin-top:5px}.device-item strong{overflow-wrap:anywhere}`;

class PlanningChauffeEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.addEventListener('change',e=>this._change(e));this.shadowRoot.addEventListener('input',e=>{if(e.target.hasAttribute('data-entity-search')){this._search=e.target.value;this._filterEntities();}});}
  set hass(value){this._hass=value;this._render();}
  setConfig(value){this._config={...value,title:value.title || 'Planning',entities:selectedPlanningEntities(value.entities),demo:value.demo ?? !value.calendar,appearance:normalizeAppearance(value.appearance)};delete this._config.groups;delete this._config.closure_calendar;delete this._config.devices;this._render();}
  _emit(){this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:{...this._config,entities:[...this._config.entities],appearance:{...this._config.appearance}}}}));}
  _filterEntities(){const term=(this._search || '').toLocaleLowerCase('fr');this.shadowRoot.querySelectorAll('[data-entity-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('fr').includes(term);row.style.display=row.hidden?'none':'';});}
  _change(event){
    const el=event.target;
    if(el.dataset.planningEntity){const selected=new Set(this._config.entities);if(el.checked)selected.add(el.dataset.planningEntity);else selected.delete(el.dataset.planningEntity);this._config.entities=[...selected];this._emit();return;}
    if(!el.dataset.field)return;
    const field=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.appearance)this._config.appearance[field]=field==='first_day'?Number(value):value;
    else this._config[field]=value;
    if(field==='calendar' && value)this._config.demo=false;
    this._emit();
    if(['calendar','demo'].includes(field))this._render();
  }
  _render(){
    if(!this._config || !this._hass)return;
    const c=this._config,a=c.appearance;
    const select=(label,field,options)=>`<label>${label}<select data-field="${field}" data-appearance="true">${Object.entries(options).map(([value,name])=>`<option value="${value}" ${String(a[field])===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    const calendars=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('calendar.'));
    const devices=Object.values(this._hass.states || {}).filter(e=>Object.hasOwn(ACTION_TYPES,e.entity_id.split('.')[0])).sort((x,y)=>(x.attributes.friendly_name || x.entity_id).localeCompare(y.attributes.friendly_name || y.entity_id,'fr'));
    const automations=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('automation.'));
    this.shadowRoot.innerHTML=`<style>:host{display:block;color:var(--primary-text-color);font-family:inherit}label{display:flex;flex-direction:column;gap:6px;margin:14px 0}input,select{font:inherit;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:11px;box-sizing:border-box;width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}details{padding:14px 0;border-top:1px solid var(--divider-color)}summary{font-weight:600}h3{margin:12px 0 4px}</style>
      <h3>Votre planning</h3>
      <label>Nom de la carte<input data-field="title" value="${esc(c.title)}"></label>
      <label>Calendrier<select data-field="calendar"><option value="">Choisir un calendrier local</option>${calendars.map(e=>`<option value="${esc(e.entity_id)}" ${e.entity_id===c.calendar?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label>
      <p>Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${c.demo?'checked':''}>Essai local, sans enregistrement dans Home Assistant</label>
      <p>${c.demo?'Les actions sont simulées.':'L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.'}</p>
      <details open><summary>Appareils proposés dans les programmations</summary>
      <p>Cochez les appareils à afficher. Sans sélection, tous les appareils compatibles restent proposés aux administrateurs. Pour configurer un démarrage Frech avec son script et son entrée, utilisez Réglages → Appareils du planning sur la carte.</p>
      <label>Rechercher un appareil<input type="search" data-entity-search value="${esc(this._search || '')}" placeholder="Nom ou identifiant de l’entité"></label>
      <div class="entity-options" style="max-height:280px;overflow:auto;border:1px solid var(--divider-color);padding:0 12px;border-radius:8px">${devices.map(e=>`<label class="check" data-entity-row><input type="checkbox" data-planning-entity="${e.entity_id}" ${c.entities.includes(e.entity_id)?'checked':''}><span>${esc(e.attributes.friendly_name || e.entity_id)}<small style="display:block">${e.entity_id}</small></span></label>`).join('') || '<p>Aucune entité compatible disponible.</p>'}</div></details>
      <details><summary>Exécution existante / migration</summary><label>Automatisation déjà utilisée<select data-field="execution_automation"><option value="">Détection automatique</option>${automations.map(e=>`<option value="${e.entity_id}" ${c.execution_automation===e.entity_id?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label><p>Choisir votre ancienne automatisation Planning permet de retrouver ses appareils Frech et leurs associations. Les nouvelles installations se préparent dans Réglages.</p></details>
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
    this._filterEntities();
  }
}
if(!customElements.get('ha-planning-card-editor'))customElements.define('ha-planning-card-editor',PlanningChauffeEditor);
if(!customElements.get('ha-planning-chauffe-card-editor'))customElements.define('ha-planning-chauffe-card-editor',class extends PlanningChauffeEditor{});









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
  getCardSize(){return 10;}
  getGridOptions(){return {columns:24,min_columns:6,rows:12,min_rows:8};}
  setConfig(config){this._config=normalizePlanningConfig(config);this._generation++;this._initialized=false;this._init();}
  set hass(value){this._hass=value;this._init();}
  connectedCallback(){if(!this._timer)this._timer=setInterval(()=>{if(this.isConnected && !this._draft && !this._settings && !this._busy && !this._pointer?.active)this._load();},60000);this._init();}
  disconnectedCallback(){clearInterval(this._timer);clearTimeout(this._toastTimer);this._timer=null;this._clearPointer();}
  _init(){
    if(!this._config || !this._hass || this._initialized)return;
    this._clearPointer();this._deviceDraft=null;
    this._initialized=true;this._zone=this._hass.config?.time_zone || 'Europe/Brussels';this._selected=dayOf(Date.now(),this._zone);this._month=this._selected.slice(0,7);this._view=this._config.appearance.default_view;this._draft=null;this._settings=false;this._events=[];this._error='';this._loaded=!!this._config.demo;this._loading=false;this._snapshot={records:[],ready:false,test_mode:true};
    this._store=new PlanningActionStore(()=>this._hass,this._config.calendar,this._config.execution_automation);
    this._render();this._load();
  }
  _range(){return viewRange(this._month,this._config.appearance.first_day);}
  _meta(event){
    if(event.meta)return event.meta;
    const old=event.legacy;
    if(!old || !['weekly','restart'].includes(old.kind) || !old.devices?.length)return null;
    const records=old.devices.map(id=>this._record(id));if(records.some(r=>!r))return null;
    return {planning:2,kind:'schedule',id:old.id || newEventId(),color:old.color,has_end:false,start_actions:records.map(r=>({target:r.id,op:defaultOperation(r)})),end_actions:[],note:old.note || ''};
  }
  _time(value){return new Intl.DateTimeFormat('fr-BE',{timeZone:this._zone,hour:'2-digit',minute:'2-digit',hour12:this._config.appearance.time_format==='12'}).format(new Date(value));}
  _label(day){return new Intl.DateTimeFormat('fr-BE',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(new Date(`${day}T12:00Z`));}
  _record(id){if(id?.startsWith('entity:')){const entity=id.slice(7);return simpleActionRecord(entity,this._hass.states[entity]?.attributes?.friendly_name);}return this._snapshot.records.find(r=>r.id===id);}
  _choices(){
    const selected=this._config.entities || [],current=new Set([...(this._draft?.start_actions || []),...(this._draft?.end_actions || [])].map(a=>a.target));
    const records=this._snapshot.records.filter(r=>r.enabled!==false && (!selected.length || selected.includes(targetEntity(r)) || current.has(r.id))).map(r=>({...r,value:r.id}));
    if(this._config.demo || this._hass.user?.is_admin)for(const [entity,state] of Object.entries(this._hass.states || {})){
      if(!ACTION_TYPES[entity.split('.')[0]] || (selected.length && !selected.includes(entity) && !current.has(`entity:${entity}`)) || this._snapshot.records.some(r=>targetEntity(r)===entity || (r.type==='frech' && r.script_entity===entity)))continue;
      try{records.push({...simpleActionRecord(entity,state.attributes?.friendly_name),value:`entity:${entity}`});}catch{/* Unsupported entities remain outside the action picker. */}
    }
    return records.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  }
  async _fetch(start,end){
    const state=this._hass.states[this._config.calendar];
    if(!state || !['on','off'].includes(state.state))throw new Error('Choisissez un calendrier local disponible dans la configuration de la carte.');
    if((Number(state.attributes.supported_features)&7)!==7)throw new Error('Ce calendrier ne permet pas toutes les modifications. Utilisez Calendrier local.');
    const query=new URLSearchParams({start:toInstant(`${start}T00:00`,this._zone),end:toInstant(`${end}T00:00`,this._zone)});
    const rows=await this._hass.callApi('GET',`calendars/${this._config.calendar}?${query}`);
    if(!Array.isArray(rows))throw new Error('Réponse calendrier invalide.');
    return rows.filter(r=>!actionRegistry(r) && !r.description?.includes('"planning_devices"')).map(r=>normalizeSchedule(r,this._config.calendar,this._zone));
  }
  async _load(){
    if(!this._initialized || this._loading)return;
    if(this._config.demo){this._expandDemo();this._loaded=true;this._render();return;}
    if(!this._config.calendar)return;
    const generation=this._generation;this._loading=true;
    try{const range=this._range();const [events,snapshot]=await Promise.all([this._fetch(range.queryStart,range.queryEnd),this._store.load()]);if(generation!==this._generation)return;if(snapshot.ready && snapshot.config && snapshot.needsPublish){try{await this._store.publish(snapshot);snapshot.needsPublish=false;}catch(e){snapshot.publishError=e.message;}}this._events=events;this._snapshot=snapshot;this._loaded=true;this._error=snapshot.publishError || '';}
    catch(e){if(generation===this._generation){this._error=e.message;this._loaded=false;}}
    finally{if(generation===this._generation){this._loading=false;this._render();}}
  }
  _expandDemo(){
    const range=this._range(),expanded=[];
    for(const row of this._demoRows){
      if(!row.rrule){expanded.push(normalizeSchedule(row,this._config.calendar || 'calendar.demo',this._zone));continue;}
      const days=(row.rrule.match(/BYDAY=([^;]+)/)?.[1] || '').split(',').map(x=>['SU','MO','TU','WE','TH','FR','SA'].indexOf(x));
      for(let day=range.queryStart;day<range.queryEnd;day=shiftDay(day,1))if(day>=dayOf(row.start,this._zone) && days.includes(weekday(day))){
        const shifted=shiftedOccurrence(row,day,undefined,this._zone),rid=localMinute(shifted.start,this._zone).replace(/[-:]/g,'')+'00';
        if(row.deleted?.includes(rid))continue;
        expanded.push(normalizeSchedule({...row,...shifted,...row.exceptions?.[rid],recurrence_id:rid},this._config.calendar || 'calendar.demo',this._zone));
      }
    }
    this._events=expanded;
  }
  _button(label,action,extra=''){return `<button type="button" data-action="${action}" ${this._busy?'disabled':''} ${extra}>${label}</button>`;}
  _executionLabel(){if(this._config.demo)return 'Essai local · aucune commande envoyée';if(!this._snapshot.ready)return 'Choisissez vos horaires, puis préparez l’exécution dans Réglages.';if(!this._snapshot.config)return 'Programmations partagées · exécution gérée par Home Assistant';if(this._hass.states[this._store.automation]?.state==='off')return 'Automatisation désactivée dans Home Assistant';return this._snapshot.test_mode?'Mode test · notifications uniquement':'Exécution Home Assistant active';}
  _eventHtml(e,style=''){
    const meta=this._meta(e),names=meta?.start_actions.map(a=>this._record(a.target)?.name || a.target).join(', ') || '';
    return `<div class="event ${meta?'':'external'}" data-event="${esc(e.key)}" draggable="${!!e.uid && !this._busy}" style="--event:${eventColor(meta?.color || e.legacy?.color)};--event-text:${colorText(meta?.color || e.legacy?.color)};${style}"><button type="button" class="event-main" data-event="${esc(e.key)}" title="${esc(`${e.summary} · ${this._time(e.start)} · Cliquer pour modifier`)}"><span>${this._time(e.start)}${meta?.has_end?' → '+this._time(e.end):''}${recurring(e)?' ↻':''}</span><strong>${esc(e.summary)}</strong>${this._config.appearance.show_device_names && names?`<small>${esc(names)}</small>`:''}</button>${e.uid?`<button type="button" class="event-handle" data-move-handle="${esc(e.key)}" title="Glisser pour déplacer ce jour" aria-label="Déplacer ${esc(e.summary)}">⠿</button>`:''}</div>`;
  }
  _dayEvents(day){return this._events.filter(e=>dayOf(e.start,this._zone)===day && e.role!=='legacy-closure').sort((a,b)=>a.start.localeCompare(b.start));}
  _calendarHtml(){
    const a=this._config.appearance,days=visibleWeekdays(a.first_day,a.show_weekends),range=this._range();
    if(this._view==='agenda')return `<div class="agenda">${this._events.filter(e=>e.role!=='legacy-closure' && dayOf(e.start,this._zone).startsWith(this._month)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>`<div class="agenda-item"><small>${this._label(dayOf(e.start,this._zone))}</small>${this._eventHtml(e)}</div>`).join('') || '<div class="empty">Aucune programmation ce mois-ci.</div>'}</div>`;
    if(this._view==='week'){
      const first=shiftDay(this._selected,-((weekday(this._selected)-a.first_day+7)%7)),week=Array.from({length:7},(_,i)=>shiftDay(first,i)).filter(d=>days.includes(weekday(d)));
      return `<div class="week-scroll"><div class="week" style="--columns:${days.length}"><div class="week-head"></div>${week.map(d=>`<div class="week-head">${this._label(d)}</div>`).join('')}<div class="hours">${Array.from({length:24},(_,i)=>`<span style="top:${i*48}px">${String(i).padStart(2,'0')}:00</span>`).join('')}</div>${week.map(d=>`<div class="week-day" data-drop="${d}" aria-label="${this._label(d)}">${packWeekEvents(this._dayEvents(d),this._zone).map(p=>this._eventHtml(p.event,`top:${p.minute/60*48}px;height:${(p.visualEnd-p.minute)/60*48}px;left:${p.lane/p.lanes*100}%;width:${100/p.lanes}%`)).join('')}</div>`).join('')}</div></div>`;
    }
    let html=days.map(d=>`<div class="weekday">${['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d]}</div>`).join('');
    for(let i=0;i<range.count;i++){const day=shiftDay(range.start,i);if(!days.includes(weekday(day)))continue;html+=`<div class="day ${day.startsWith(this._month)?'':'outside'} ${day===this._selected?'selected':''}" data-drop="${day}"><button class="date" type="button" data-day="${day}" aria-label="Ajouter le ${esc(this._label(day))}">${Number(day.slice(8))}</button>${this._dayEvents(day).map(e=>this._eventHtml(e)).join('')}</div>`;}
    return `<div class="calendar" style="--columns:${days.length};--weeks:${range.count/7}">${html}</div>`;
  }
  _timeSelect(prefix,value){const [h,m]=value.split(':');return `<div class="time"><select name="${prefix}_hour" aria-label="Heure ${prefix==='start'?'de début':'de fin'}">${Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(x=>`<option ${x===h?'selected':''}>${x}</option>`).join('')}</select><span>:</span><select name="${prefix}_minute" aria-label="Minute ${prefix==='start'?'de début':'de fin'}">${[...new Set(['00','10','20','30','40','50',m])].sort().map(x=>`<option ${x===m?'selected':''}>${x}</option>`).join('')}</select></div>`;}
  _actionsHtml(phase){
    const choices=this._choices(),list=this._draft[phase];
    return list.map((row,index)=>{const record=this._record(row.target),ops=operationsFor(record);return `<div class="action-row" data-phase="${phase}" data-index="${index}"><select data-target aria-label="Appareil ${phase==='start_actions'?'au début':'à la fin'} ${index+1}"><option value="">Choisir un appareil ou un script</option>${choices.map(r=>`<option value="${esc(r.value)}" ${r.value===row.target?'selected':''}>${esc(r.name)}</option>`).join('')}${row.target && !choices.some(r=>r.value===row.target)?`<option selected value="${esc(row.target)}">${esc(row.target)} (indisponible)</option>`:''}</select><select data-operation aria-label="Action ${index+1}">${Object.entries(ops).map(([value,label])=>`<option value="${value}" ${row.op===value?'selected':''}>${label}</option>`).join('')}</select><button type="button" data-remove-action aria-label="Retirer l’action ${index+1}">×</button></div>`;}).join('');
  }
  _formHtml(){
    const d=this._draft,existing=!!d.uid,isRecurring=!!d.rrule || !!d.recurrence_id;
    if(d.calendarOnly)return this._calendarOnlyFormHtml();
    if(d.readonly)return `<section class="panel"><h2>${esc(d.summary)}</h2><p>Ce calendrier ne fournit pas d’identifiant modifiable pour cet événement. Utilisez un calendrier local permettant sa modification.</p>${this._button('Fermer','cancel')}</section>`;
    return `<form><div class="toolbar"><h2>${existing?'Modifier cette programmation':'Nouvelle programmation'}</h2>${this._button('Fermer','cancel')}</div>${existing && isRecurring?'<p class="status notice">Seul ce jour sera modifié. Les autres occurrences gardent leur horaire et leurs actions.</p>':''}<label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}" placeholder="Ex. Chauffe atelier ou ouverture barrière"></label><div class="grid2"><label>Date${existing?' de cette occurrence':' de début'}<input required type="date" name="date" value="${d.date}"></label>${!existing?`<label>Répétition<select name="repeat"><option value="once" ${d.repeat==='once'?'selected':''}>Une seule fois</option><option value="weekly" ${d.repeat==='weekly'?'selected':''}>Chaque semaine</option></select></label>`:'<p class="hint">Pour déplacer, changez la date ou l’heure. Vous pouvez aussi glisser la programmation sur le calendrier.</p>'}</div>${!existing && d.repeat==='weekly'?`<div class="field"><label>Jours habituels</label><div class="weekdays">${[1,2,3,4,5,6,0].map(i=>`<label class="check"><input type="checkbox" data-weekday="${i}" ${d.days.includes(i)?'checked':''}>${['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][i]}</label>`).join('')}</div><p class="hint">Créez autant de programmations que nécessaire pour des horaires différents.</p></div>`:''}<h3>Au début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}${this._actionsHtml('start_actions')}${this._button('+ Ajouter une action','add-start')}<label class="check field"><input name="has_end" type="checkbox" ${d.has_end?'checked':''}>Prévoir une heure et des actions de fin</label>${d.has_end?`<h3>À la fin</h3>${this._timeSelect('end',`${d.end_hour}:${d.end_minute}`)}<p class="hint">Si l’heure de fin précède l’heure de début, le créneau se termine le lendemain.</p>${this._actionsHtml('end_actions')}${this._button('+ Ajouter une action à la fin','add-end')}`:'<p class="hint">Action ponctuelle : adapté au démarrage des Frech, sans arrêt programmé.</p>'}<div class="grid2 field"><label>Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label><label>Note facultative<textarea name="note" rows="2">${esc(d.note)}</textarea></label></div>${!this._config.demo && !this._snapshot.ready?'<p class="status">Le premier enregistrement préparera l’exécution du calendrier en mode test. Un administrateur est nécessaire.</p>':''}<div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>${this._busy?'Enregistrement…':'Enregistrer'}</button>${this._button('Annuler','cancel')}${existing?this._button(isRecurring?'Supprimer ce jour':'Supprimer','delete','class="danger"'):''}</div>${existing && isRecurring?`<details><summary>Toute la série</summary><p class="hint">La suppression de série retire toutes ses occurrences, y compris les jours déplacés.</p>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toutes les occurrences de cette série ?':'Supprimer uniquement cette occurrence ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _calendarOnlyFormHtml(){
    const d=this._draft;
    return `<form><div class="toolbar"><h2>Modifier cette programmation</h2>${this._button('Fermer','cancel')}</div><p class="status notice">${recurring(d)?'Seul ce jour sera modifié. ':''}L’horaire peut être modifié sans changer les actions existantes.</p><label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}"></label><label class="field">Date de cette occurrence<input type="date" required name="date" value="${d.date}"></label><h3>Heure de début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}<p class="hint">La durée de l’événement et ses associations existantes sont conservées.</p><label class="field">${d.legacy?'Note':'Description'}<textarea name="note" rows="3">${esc(d.note)}</textarea></label><div class="buttons"><button type="submit" class="primary" ${this._busy?'disabled':''}>Enregistrer</button>${this._button('Annuler','cancel')}${this._button(recurring(d)?'Supprimer ce jour':'Supprimer','delete','class="danger"')}</div><details><summary>Actions et appareils</summary><p>Pour associer des appareils à cette programmation et utiliser les actions de début/fin de Planning :</p>${this._button('Configurer les actions','configure-actions')}</details>${recurring(d)?`<details><summary>Toute la série</summary>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toute la série ?':'Supprimer uniquement ce jour ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _settingsHtml(){return `<section class="panel"><div class="toolbar"><h2>Réglages du planning</h2>${this._button('Fermer','settings')}</div><p class="status">${esc(this._executionLabel())}</p>${!this._config.demo && !this._snapshot.ready?this._button('Préparer l’exécution en mode test','setup','class="primary"'):''}${this._deviceSettingsHtml()}<p class="hint">Pour choisir les appareils affichés sur cette carte : Modifier la carte → Appareils proposés dans les programmations. Pour les couleurs et la vue initiale : Personnalisation.</p></section>`;}
  _render(){
    if(!this._initialized)return;
    const dialogState=this._rememberDialog();
    const a=this._config.appearance,title=this._view==='week'?`Semaine du ${this._label(shiftDay(this._selected,-((weekday(this._selected)-a.first_day+7)%7)))}`:new Intl.DateTimeFormat('fr-BE',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(`${this._month}-01T12:00Z`));
    this.shadowRoot.innerHTML=`<style>${PLANNING_STYLE}${INTERACTION_STYLE}${DEVICE_SETTINGS_STYLE}</style><ha-card><main data-density="${a.density}" data-event-style="${a.event_style}" ${a.accent_color?`style="--accent:${a.accent_color}"`:''}><header class="toolbar"><h1>${esc(this._config.title)}</h1><div class="buttons">${this._button('+ Programmation','new','class="primary" '+(!this._config.demo && !this._loaded?'disabled':''))}${this._button('⚙ Réglages','settings')}</div></header><div class="status">${esc(this._executionLabel())}</div>${this._error?`<div role="alert" class="status error">${esc(this._error)}</div>`:''}${this._notice?`<div role="status" class="status notice">${esc(this._notice)}</div>`:''}<nav class="tabs" aria-label="Vue du calendrier">${Object.entries({month:'Mois',week:'Semaine',agenda:'Agenda'}).map(([id,label])=>this._button(label,`view-${id}`,`aria-pressed="${id===this._view}"`)).join('')}${this._button('Aujourd’hui','today')}</nav><div class="toolbar"><h2>${esc(title)}</h2><div class="buttons">${this._button('‹','previous','aria-label="Période précédente"')}${this._button('›','next','aria-label="Période suivante"')}${this._button('↻','refresh','aria-label="Actualiser"')}</div></div>${this._calendarHtml()}<p class="hint">Cliquez sur une programmation pour la modifier. Glissez la poignée ⠿ pour déplacer seulement ce jour. En vue Semaine, l’heure se règle par pas de 10 minutes. Vous pouvez aussi cliquer pour modifier la date et l’heure.</p>${this._settings?this._settingsHtml():''}${this._draft?this._formHtml():''}</main></ha-card>`;
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
    this._restoreDialog(dialogState);
  }
  _open(event,date=this._selected){
    this._error='';this._notice='';this._settings=false;this._deviceDraft=null;
    const start=event?localMinute(event.start,this._zone):`${date}T06:00`,end=event?localMinute(event.end,this._zone):`${date}T07:00`,m=event?this._meta(event):null;
    this._draft={...(event || {}),original:event?{...event}:null,actionSnapshot:structuredClone(this._snapshot),readonly:!!event && !m,calendar:this._config.calendar || 'calendar.demo',event_id:m?.id || newEventId(),summary:event?.summary || '',date:start.slice(0,10),start_hour:start.slice(11,13),start_minute:start.slice(14,16),end_hour:end.slice(11,13),end_minute:end.slice(14,16),repeat:event?.rrule?'weekly':'once',days:[weekday(date)],has_end:m?.has_end || false,start_actions:m?structuredClone(m.start_actions):[{target:'',op:''}],end_actions:m?structuredClone(m.end_actions):[],color:m?.color || '#3689e6',note:m?.note || '',scope:'occurrence'};
    this._draft.readonly=!!event && !event.uid;
    this._draft.calendarOnly=!!event?.uid && !event.meta;
    if(this._draft.calendarOnly)this._draft.note=event.legacy?.note || (event.legacy?'':event.description || '');
    this._render();
  }
  _change(event){
    const el=event.target;if(this._deviceChange(el))return;const d=this._draft;if(!d)return;
    const rowEl=el.closest('.action-row');
    if(rowEl){const row=d[rowEl.dataset.phase][Number(rowEl.dataset.index)];if(el.hasAttribute('data-target')){row.target=el.value;row.op=defaultOperation(this._record(row.target));this._render();}else if(el.hasAttribute('data-operation'))row.op=el.value;return;}
    if(el.dataset.weekday!==undefined){d.days=Array.from(this.shadowRoot.querySelectorAll('[data-weekday]:checked'),e=>Number(e.dataset.weekday));return;}
    if(!el.name)return;d[el.name]=el.type==='checkbox'?el.checked:el.value;
    if(el.name==='date' && !d.uid && d.repeat==='once' && /^\d{4}-\d{2}-\d{2}$/.test(d.date))d.days=[weekday(d.date)];
    if(el.name==='has_end' && d.has_end && !d.end_actions.length)d.end_actions=d.start_actions.filter(a=>a.target && oppositeOperation(a.op) && Object.hasOwn(operationsFor(this._record(a.target)),oppositeOperation(a.op))).map(a=>({target:a.target,op:oppositeOperation(a.op)}));
    if(['repeat','has_end'].includes(el.name))this._render();
  }
  _draftDates(d){
    const time=`${d.start_hour}:${d.start_minute}`;
    if(d.calendarOnly)return shiftedOccurrence(d.original,d.date,Number(d.start_hour)*60+Number(d.start_minute),this._zone);
    const start=!d.uid && d.repeat==='weekly'?weeklyStart(d.date,time,d.days,this._zone,Date.now(),this._config.demo):toInstant(`${d.date}T${time}`,this._zone);
    let end=new Date(Date.parse(start)+60000).toISOString();
    if(d.has_end){let day=dayOf(start,this._zone),endTime=`${d.end_hour}:${d.end_minute}`;if(endTime<=time)day=shiftDay(day,1);end=toInstant(`${day}T${endTime}`,this._zone);}
    return {start,end};
  }
  async _freshFor(event,target){
    const from=[dayOf(event.start,this._zone),target?dayOf(target.start,this._zone):'9999-12-31'].sort()[0],to=[dayOf(event.end,this._zone),target?dayOf(target.end,this._zone):'0000-01-01'].sort().at(-1);
    const rows=await this._fetch(shiftDay(from,-1),shiftDay(to,2)),same=rows.find(x=>x.uid===event.uid && (x.recurrence_id || '')===(event.recurrence_id || ''));
    if(!same || scheduleFingerprint(same)!==scheduleFingerprint(event))throw new Error('Cette occurrence a changé ou a été supprimée. Actualisez avant de recommencer.');
    const issue=mutationIssue(same,'occurrence',rows);if(issue)throw new Error(issue);return rows;
  }
  async _freshForIfLive(event,target){const issue=mutationIssue(event,'occurrence',this._events);if(issue)throw new Error(issue);occurrenceSelector(event);if(!this._config.demo)await this._freshFor(event,target);}
  _demoWrite(payload){
    const row=this._demoRows.find(x=>x.uid===payload.uid);
    if(payload.type.endsWith('/delete')){if(payload.recurrence_id){row.deleted=[...(row.deleted || []),payload.recurrence_id];if(row.exceptions)delete row.exceptions[payload.recurrence_id];}else this._demoRows=this._demoRows.filter(x=>x.uid!==payload.uid);return;}
    const saved={...payload.event,start:payload.event.dtstart,end:payload.event.dtend,uid:payload.uid || newEventId()};
    if(payload.recurrence_id){row.exceptions={...row.exceptions,[payload.recurrence_id]:saved};}else if(row)Object.assign(row,saved);else this._demoRows.push(saved);
  }
  async _write(payload,draft){
    if(this._config.demo){this._demoWrite(payload);return;}
    try{await this._hass.callWS(payload);}catch(error){
      if(!draft)throw error;
      const rows=await this._fetch(shiftDay(dayOf(draft.start,this._zone),-1),shiftDay(dayOf(draft.end,this._zone),2));
      const found=rows.filter(e=>(payload.uid?e.uid===payload.uid:e.meta?.id===draft.event_id) && e.start===draft.start && e.end===draft.end && e.summary===draft.summary.trim() && (e.description || '')===payload.event.description && (!payload.recurrence_id || e.recurrence_id===payload.recurrence_id));
      if(found.length!==1)throw error;
    }
  }
  async _save(){
    if(this._busy || !this._draft)return;this._busy=true;this._error='';const d=this._draft;
    try{
      if(!this._config.demo && d.pendingCreate){const pending=d.pendingCreate,rows=await this._fetch(shiftDay(dayOf(pending.start,this._zone),-1),shiftDay(dayOf(pending.end,this._zone),2));const found=rows.filter(e=>e.meta?.id===d.event_id);if(found.length){if(!found.some(e=>e.start===pending.start && e.end===pending.end && e.description===pending.description))throw new Error('Une programmation avec cet identifiant existe déjà. Actualisez avant de recommencer.');this._draft=null;this._notice='La première sauvegarde est déjà enregistrée. Ouvrez la programmation pour la modifier.';await this._load();return;}}
      if(!d.summary.trim())throw new Error('Donnez un nom à la programmation.');
      Object.assign(d,this._draftDates(d));
      if(d.calendarOnly){if(!this._config.demo && Date.parse(d.start)<Date.now()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');await this._freshForIfLive(d.original,d);const description=d.legacy?(d.note===(d.legacy.note || '')?d.original.description:JSON.stringify({...d.legacy,note:d.note})):d.note;await this._write(calendarEditPayload(d.original,{...d,description}),d);this._draft=null;this._notice='Cette occurrence a été modifiée. Ses actions existantes sont conservées.';await this._load();return;}
      const initialIssue=validateSchedule(d,this._choices().map(r=>({...r,id:r.value})),Date.now(),this._config.demo);if(initialIssue)throw new Error(initialIssue);
      if(d.original){const issue=mutationIssue(d.original,'occurrence',this._events);if(issue)throw new Error(issue);occurrenceSelector(d.original);if(!this._config.demo)await this._freshFor(d.original,d);}
      let actions=[...d.start_actions,...(d.has_end?d.end_actions:[])],resolved;
      if(this._config.demo){resolved=actions.map(a=>{if(a.target?.startsWith('entity:')){const r=this._record(a.target);if(!this._snapshot.records.some(x=>x.id===r.id))this._snapshot.records.push(r);return {...a,target:r.id};}return a;});}
      else{if(!this._snapshot.ready)this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);const result=await this._store.prepare(d.actionSnapshot,actions);this._snapshot=result.snapshot;resolved=result.actions;}
      const draft={...d,start_actions:resolved.slice(0,d.start_actions.length),end_actions:d.has_end?resolved.slice(d.start_actions.length):[],rrule:!d.uid && d.repeat==='weekly'?`FREQ=WEEKLY;BYDAY=${[...d.days].sort((a,b)=>((a+6)%7)-((b+6)%7)).map(i=>['SU','MO','TU','WE','TH','FR','SA'][i]).join(',')}`:d.rrule};
      const issue=validateSchedule(draft,this._snapshot.records,Date.now(),this._config.demo);if(issue)throw new Error(issue);
      const payload=schedulePayload(draft);if(!this._config.demo){if(d.original)await this._freshFor(d.original,draft);else d.pendingCreate={start:draft.start,end:draft.end,description:payload.event.description};}await this._write(payload,draft);this._draft=null;this._notice=d.uid?'Cette occurrence a été modifiée.':'Programmation enregistrée.';await this._load();
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

})();
