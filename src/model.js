export const MIN_LEAD_MINUTES = 20;
export const META_VERSION = 1;
export function newEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return `pc-${Array.from(values, n => n.toString(16).padStart(8, '0')).join('')}`;
}
export const DEFAULT_GROUPS = [];
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function parts(instant, zone) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  return Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
}
export function localMinute(instant, zone) {
  const p = parts(instant, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function dayOf(instant, zone) { return localMinute(instant, zone).slice(0, 10); }
export function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function weekday(day) { return new Date(`${day}T12:00:00Z`).getUTCDay(); }
export function cycleDay(day) { return shiftDay(day, -weekday(day)); }
export function toInstant(local, zone) {
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
export function eventTime(value, zone) {
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
export function metadata(description) {
  try {
    const value = JSON.parse(description || 'null');
    return value && !Array.isArray(value) && value.planning_chauffe === META_VERSION && ['weekly', 'restart', 'closure'].includes(value.kind) ? value : null;
  } catch { return null; }
}
export function normalizeEvent(raw, calendar, role, groupIndex, zone, groups = []) {
  let meta = metadata(raw.description);
  if (role === 'shared') {
    role = meta?.kind === 'closure' ? 'closure' : 'group';
    groupIndex = role === 'closure' ? null : groups.findIndex(g => g.id === (meta?.group || ''));
    if (role === 'group' && groupIndex < 0) meta = null;
  }
  if ((role === 'closure' && meta?.kind !== 'closure') || (role === 'group' && meta?.kind === 'closure')) meta = null;
  return { ...raw, calendar, role, groupIndex, start: eventTime(raw.start, zone), end: eventTime(raw.end, zone), meta, key: `${calendar}|${raw.uid || raw.summary}|${eventTime(raw.start, zone)}` };
}
export function sameGroup(a, b) {
  return a.calendar === b.calendar && (a.group ?? a.meta?.group ?? '') === (b.group ?? b.meta?.group ?? '');
}
export function isClosed(events, at) {
  const t = Date.parse(at);
  return events.some(e => e.role === 'closure' && Date.parse(e.start) <= t && t < Date.parse(e.end));
}
export function eventStatus(event, events, zone) {
  if (event.role === 'closure') return 'closure';
  if (!event.meta || !['weekly', 'restart'].includes(event.meta.kind)) return 'external';
  if (isClosed(events, event.start)) return 'closed';
  if (event.meta.kind === 'weekly') {
    const cycle = cycleDay(dayOf(event.start, zone));
    const replaced = events.some(e => sameGroup(e, event) && e.meta?.kind === 'restart' && (e.meta.replace === true || e.start === event.start) && cycleDay(dayOf(e.start, zone)) === cycle);
    if (replaced) return 'replaced';
  }
  return 'planned';
}
export function validateConfig(input) {
  const config = { title: 'Planning', demo: !input.calendar, calendar: '', ...input };
  if (config.title === 'Planning de chauffe') config.title = 'Planning';
  config.groups = (input.groups || DEFAULT_GROUPS).map(g => ({ name: String(g.name || '').trim(), calendar: g.calendar || '' }));
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
export function resolveGroups(config, calendarLabel = '') {
  if (!config.calendar) return config.groups.map(g => ({ ...g, id: '' }));
  const named = config.groups.filter(g => g.name.trim());
  if (!named.length) return [{ name: calendarLabel || 'Calendrier', calendar: config.calendar, id: '' }];
  return named.map(g => ({ ...g, calendar: config.calendar, id: g.name }));
}
export function validateDraft(draft, events, zone, now = Date.now(), demo = false) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un libellé à la période d’exclusion.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Cette programmation se trouve pendant une exclusion. Modifiez la date ou l’exclusion.';
  if (events.some(e => sameGroup(e, draft) && e.uid !== draft.uid && e.meta?.kind === 'restart' && e.start === draft.start && draft.kind === 'restart')) return 'Une programmation existe déjà pour ce groupe à cette heure.';
  if (draft.kind === 'weekly' && events.some(e => sameGroup(e, draft) && e.uid !== draft.uid && e.meta?.kind === 'weekly')) return 'Ce groupe possède déjà un horaire habituel. Modifiez cet horaire.';
  return '';
}
export function calendarPayload(draft) {
  const event = { dtstart: draft.start, dtend: draft.end, summary: draft.summary.trim(), description: JSON.stringify({ planning_chauffe: META_VERSION, kind: draft.kind, group: draft.kind === 'closure' ? undefined : draft.group, id: draft.event_id, replace: draft.kind === 'restart' && draft.replace === true, note: draft.note || '' }) };
  if (draft.kind === 'weekly') event.rrule = draft.rrule;
  return { type: `calendar/event/${draft.uid ? 'update' : 'create'}`, entity_id: draft.calendar, ...(draft.uid ? { uid: draft.uid } : {}), event };
}
export function deletionPayload(event) { return { type: 'calendar/event/delete', entity_id: event.calendar, uid: event.uid }; }
export function nextWeekly(day, time, zone, now = Date.now()) {
  let date = dayOf(now + MIN_LEAD_MINUTES * 60000, zone);
  date = shiftDay(date, (Number(day) - weekday(date) + 7) % 7);
  let instant = toInstant(`${date}T${time}`, zone);
  if (Date.parse(instant) < now + MIN_LEAD_MINUTES * 60000) instant = toInstant(`${shiftDay(date, 7)}T${time}`, zone);
  return instant;
}
export function viewRange(month) {
  const first = `${month}-01`, start = shiftDay(first, -((weekday(first) + 6) % 7));
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const days = Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(first)) / 86400000);
  const count = Math.ceil((((weekday(first) + 6) % 7) + days) / 7) * 7;
  return { start, end: shiftDay(start, count), count, queryStart: shiftDay(start, -7), queryEnd: shiftDay(start, count + 7) };
}
export function emptyLocalState(zone, now = Date.now()) {
  return { events: [], selected: dayOf(now, zone) };
}
