export const MIN_LEAD_MINUTES = 20;
export const META_VERSION = 1;
export function newEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return `pc-${Array.from(values, n => n.toString(16).padStart(8, '0')).join('')}`;
}
export const DEFAULT_GROUPS = [
  { name: 'Frech', calendar: '', day: 1, time: '01:00' },
  { name: 'Frech – Grand Bain', calendar: '', day: 0, time: '23:20' },
  { name: 'Frech 20', calendar: '', day: 0, time: '18:00' },
];
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
export function normalizeEvent(raw, calendar, role, groupIndex, zone) {
  let meta = metadata(raw.description);
  if ((role === 'closure' && meta?.kind !== 'closure') || (role === 'group' && meta?.kind === 'closure')) meta = null;
  return { ...raw, calendar, role, groupIndex, start: eventTime(raw.start, zone), end: eventTime(raw.end, zone), meta, key: `${calendar}|${raw.uid || raw.summary}|${eventTime(raw.start, zone)}` };
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
    const replaced = events.some(e => e.calendar === event.calendar && e.meta?.kind === 'restart' && (e.meta.replace === true || e.start === event.start) && cycleDay(dayOf(e.start, zone)) === cycle);
    if (replaced) return 'replaced';
  }
  return 'planned';
}
export function validateConfig(input) {
  const config = { title: 'Planning de chauffe', demo: true, ...input };
  config.groups = (input.groups || DEFAULT_GROUPS).map(g => ({ name: g.name || 'Groupe', calendar: g.calendar || '' }));
  if (!config.groups.length || config.groups.length > 8) throw new Error('Configurez de 1 à 8 groupes.');
  if (!config.demo) {
    const ids = [config.closure_calendar, ...config.groups.map(g => g.calendar)];
    if (ids.some(x => typeof x !== 'string' || !/^calendar\.[a-z0-9_]+$/.test(x))) throw new Error('Choisissez un calendrier de fermeture et un calendrier pour chaque groupe.');
    if (new Set(ids).size !== ids.length) throw new Error('Chaque groupe et les fermetures doivent utiliser des calendriers distincts.');
  }
  return config;
}
export function validateDraft(draft, events, zone, now = Date.now(), demo = false) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un nom à la fermeture.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Ce démarrage se trouve pendant une fermeture. Modifiez la date ou la fermeture.';
  if (events.some(e => e.calendar === draft.calendar && e.uid !== draft.uid && e.meta?.kind === 'restart' && e.start === draft.start && draft.kind === 'restart')) return 'Une reprise existe déjà pour ce groupe à cette heure.';
  if (draft.kind === 'weekly' && events.some(e => e.calendar === draft.calendar && e.uid !== draft.uid && e.meta?.kind === 'weekly')) return 'Ce groupe possède déjà un horaire habituel. Modifiez cet horaire.';
  return '';
}
export function calendarPayload(draft) {
  const event = { dtstart: draft.start, dtend: draft.end, summary: draft.summary.trim(), description: JSON.stringify({ planning_chauffe: META_VERSION, kind: draft.kind, id: draft.event_id, replace: draft.kind === 'restart' && draft.replace === true, note: draft.note || '' }) };
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
export function demoEvents(config, zone, now = Date.now()) {
  const first = `${dayOf(now, zone).slice(0, 7)}-01`;
  const monday = shiftDay(first, (8 - weekday(first)) % 7);
  const closeStart = shiftDay(monday, 7), closeEnd = shiftDay(closeStart, 14);
  const events = [];
  const closure = { uid: 'demo-closure', summary: 'Arrêt de deux semaines', start: toInstant(`${closeStart}T00:00`, zone), end: toInstant(`${closeEnd}T00:00`, zone), description: JSON.stringify({ planning_chauffe: 1, kind: 'closure' }) };
  events.push(normalizeEvent(closure, 'calendar.demo_closures', 'closure', null, zone));
  config.groups.forEach((g, index) => {
    const pattern = DEFAULT_GROUPS[index] || DEFAULT_GROUPS[0];
    for (let i = -7; i < 65; i++) {
      const day = shiftDay(first, i);
      if (weekday(day) !== pattern.day) continue;
      const start = toInstant(`${day}T${pattern.time}`, zone);
      events.push(normalizeEvent({ uid: `demo-weekly-${index}`, summary: g.name, start, end: new Date(Date.parse(start) + 300000).toISOString(), rrule: `FREQ=WEEKLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][pattern.day]}`, description: JSON.stringify({ planning_chauffe: 1, kind: 'weekly' }) }, `calendar.demo_group_${index}`, 'group', index, zone));
    }
    if (index > 0) {
      const start = toInstant(`${closeEnd}T${index === 1 ? '04:00' : '02:00'}`, zone);
      events.push(normalizeEvent({ uid: `demo-restart-${index}`, summary: `Reprise ${g.name}`, start, end: new Date(Date.parse(start) + 300000).toISOString(), description: JSON.stringify({ planning_chauffe: 1, kind: 'restart', replace: true }) }, `calendar.demo_group_${index}`, 'group', index, zone));
    }
  });
  return { events, selected: closeEnd };
}
