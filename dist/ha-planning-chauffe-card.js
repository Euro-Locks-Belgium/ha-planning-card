/* Planning de chauffe 0.1.0 | Euro-Locks Belgium */
(() => {
'use strict';
const VERSION = "0.1.0";
const MIN_LEAD_MINUTES = 20;
const META_VERSION = 1;
function newEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return `pc-${Array.from(values, n => n.toString(16).padStart(8, '0')).join('')}`;
}
const DEFAULT_GROUPS = [
  { name: 'Frech', calendar: '', day: 1, time: '01:00' },
  { name: 'Frech – Grand Bain', calendar: '', day: 0, time: '23:20' },
  { name: 'Frech 20', calendar: '', day: 0, time: '18:00' },
];
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
    return value && !Array.isArray(value) && value.planning_chauffe === META_VERSION && ['weekly', 'restart', 'closure'].includes(value.kind) ? value : null;
  } catch { return null; }
}
function normalizeEvent(raw, calendar, role, groupIndex, zone) {
  let meta = metadata(raw.description);
  if ((role === 'closure' && meta?.kind !== 'closure') || (role === 'group' && meta?.kind === 'closure')) meta = null;
  return { ...raw, calendar, role, groupIndex, start: eventTime(raw.start, zone), end: eventTime(raw.end, zone), meta, key: `${calendar}|${raw.uid || raw.summary}|${eventTime(raw.start, zone)}` };
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
    const replaced = events.some(e => e.calendar === event.calendar && e.meta?.kind === 'restart' && (e.meta.replace === true || e.start === event.start) && cycleDay(dayOf(e.start, zone)) === cycle);
    if (replaced) return 'replaced';
  }
  return 'planned';
}
function validateConfig(input) {
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
function validateDraft(draft, events, zone, now = Date.now(), demo = false) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un nom à la fermeture.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Ce démarrage se trouve pendant une fermeture. Modifiez la date ou la fermeture.';
  if (events.some(e => e.calendar === draft.calendar && e.uid !== draft.uid && e.meta?.kind === 'restart' && e.start === draft.start && draft.kind === 'restart')) return 'Une reprise existe déjà pour ce groupe à cette heure.';
  if (draft.kind === 'weekly' && events.some(e => e.calendar === draft.calendar && e.uid !== draft.uid && e.meta?.kind === 'weekly')) return 'Ce groupe possède déjà un horaire habituel. Modifiez cet horaire.';
  return '';
}
function calendarPayload(draft) {
  const event = { dtstart: draft.start, dtend: draft.end, summary: draft.summary.trim(), description: JSON.stringify({ planning_chauffe: META_VERSION, kind: draft.kind, id: draft.event_id, replace: draft.kind === 'restart' && draft.replace === true, note: draft.note || '' }) };
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
function viewRange(month) {
  const first = `${month}-01`, start = shiftDay(first, -((weekday(first) + 6) % 7));
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const days = Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(first)) / 86400000);
  const count = Math.ceil((((weekday(first) + 6) % 7) + days) / 7) * 7;
  return { start, end: shiftDay(start, count), count, queryStart: shiftDay(start, -7), queryEnd: shiftDay(start, count + 7) };
}
function demoEvents(config, zone, now = Date.now()) {
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

const STYLES = "\n#zamak-planning{--ha-bg:light-dark(#f5f6f8,#111315);--ha-surface:light-dark(#fff,#1d1f21);--ha-text:light-dark(#18252c,#e8edf0);--ha-muted:light-dark(#53636d,#a6b2bb);--ha-border:light-dark(#dce3e8,#363b40);--ha-accent:light-dark(#006e8c,#32c5eb);--ha-accent-text:light-dark(#fff,#002c39);--ha-accent-soft:light-dark(#e7f6fb,#17353d);--ha-purple:light-dark(#7251a8,#c3a5f1);--ha-purple-soft:light-dark(#f1ecfa,#30263f);--ha-orange:light-dark(#8c4c09,#f0bb73);--ha-orange-soft:light-dark(#fff2df,#3b3021);--ha-error:light-dark(#b52f3f,#ffadb5);--ha-error-soft:light-dark(#fff0f0,#3c2429);--ha-inset:light-dark(#edf1f4,#292d31);color:var(--ha-text);background:var(--ha-bg);font:14px/1.45 \"Segoe UI\",Arial,sans-serif;border:1px solid var(--ha-border);border-radius:14px;overflow:hidden;position:relative;isolation:isolate;color-scheme:inherit}\n#zamak-planning *{box-sizing:border-box}#zamak-planning [hidden]{display:none!important}#zamak-planning h1,#zamak-planning h2,#zamak-planning h3,#zamak-planning p{margin:0}#zamak-planning h1{font-size:25px;font-weight:500;letter-spacing:-.6px}#zamak-planning h2{font-size:17px;font-weight:500}#zamak-planning h3{font-size:15px;font-weight:500}#zamak-planning button,#zamak-planning input,#zamak-planning select{font:inherit}#zamak-planning button{color:inherit}#zamak-planning button:focus-visible,#zamak-planning input:focus-visible,#zamak-planning select:focus-visible{outline:2px solid var(--ha-accent);outline-offset:3px}#zamak-planning svg{width:18px;height:18px;flex-shrink:0}#zamak-planning .ha-secondary{color:var(--ha-muted);font-size:12px}#zamak-planning .ha-appbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 24px;background:var(--ha-surface);border-bottom:1px solid var(--ha-border);padding-right:108px}#zamak-planning .ha-brand{display:flex;gap:10px;align-items:center;font-weight:500;flex-wrap:wrap}#zamak-planning .ha-brand>svg{color:var(--ha-accent)}#zamak-planning .ha-slash{color:var(--ha-muted);font-weight:400}#zamak-planning .ha-preview{color:var(--ha-muted);font-size:12px;white-space:nowrap}#zamak-planning .ha-main{padding:24px}#zamak-planning .ha-heading{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}#zamak-planning .ha-heading p{margin-top:5px}#zamak-planning .ha-actions{display:flex;gap:8px;flex-wrap:wrap}#zamak-planning .ha-button{display:inline-flex;gap:7px;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:8px;background:var(--ha-surface);padding:10px 13px;min-height:40px;font-weight:500;white-space:normal;text-align:center}#zamak-planning .ha-button:hover{background:var(--ha-inset)}#zamak-planning .ha-primary{background:var(--ha-accent);border-color:var(--ha-accent);color:var(--ha-accent-text)}#zamak-planning .ha-primary:hover{background:var(--ha-accent);filter:brightness(.95)}#zamak-planning .ha-button:disabled{opacity:.45;cursor:not-allowed}#zamak-planning .ha-small{font-size:12px;padding:7px 9px;min-height:32px}#zamak-planning .ha-iconbutton{background:transparent;border:1px solid var(--ha-border);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:7px}#zamak-planning .ha-demo{display:flex;gap:8px;align-items:center;color:var(--ha-muted);font-size:12px;margin:18px 0 14px}#zamak-planning .ha-demo svg{width:15px;height:15px}#zamak-planning .ha-tabs{display:flex;gap:22px;border-bottom:1px solid var(--ha-border);margin-bottom:20px}#zamak-planning .ha-tabs button{border:0;border-bottom:2px solid transparent;padding:10px 0;background:transparent;color:var(--ha-muted);font-weight:500}#zamak-planning .ha-tabs button[aria-selected=true]{color:var(--ha-accent);border-bottom-color:var(--ha-accent)}#zamak-planning .ha-workspace{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}#zamak-planning .ha-calendar{border:1px solid var(--ha-border);border-radius:10px;background:var(--ha-surface);overflow:hidden;min-width:0}#zamak-planning .ha-monthbar{padding:15px;display:flex;justify-content:space-between;gap:8px;align-items:center}#zamak-planning .ha-month-title{display:flex;flex-direction:column;gap:2px}#zamak-planning .ha-monthnav{display:flex;gap:6px}#zamak-planning .ha-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));text-align:right;color:var(--ha-muted);font-size:11px;padding:0 7px 8px}#zamak-planning .ha-days span{padding-right:6px}#zamak-planning .ha-monthgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--ha-border)}#zamak-planning .ha-day{background:var(--ha-surface);border:0;border-right:1px solid var(--ha-border);border-bottom:1px solid var(--ha-border);min-height:91px;min-width:0;display:flex;flex-direction:column;gap:3px;padding:6px 4px;text-align:left;position:relative}#zamak-planning .ha-day:nth-child(7n){border-right:0}#zamak-planning .ha-day:hover{background:var(--ha-inset)}#zamak-planning .ha-day.outside{color:var(--ha-muted);background:var(--ha-bg)}#zamak-planning .ha-day.closed{background:var(--ha-orange-soft)}#zamak-planning .ha-day.selected{box-shadow:inset 0 0 0 2px var(--ha-accent);z-index:1}#zamak-planning .ha-date{align-self:flex-end;min-width:23px;text-align:center;font-size:12px;line-height:23px;border-radius:50%}#zamak-planning .ha-day.selected .ha-date{background:var(--ha-accent);color:var(--ha-accent-text)}#zamak-planning .ha-dayevent{display:block;border-radius:3px;padding:2px 4px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;background:var(--ha-accent-soft);color:var(--ha-accent);font-weight:500}#zamak-planning .ha-dayevent.exceptional{background:var(--ha-purple-soft);color:var(--ha-purple)}#zamak-planning .ha-dayevent.cancelled{background:var(--ha-inset);color:var(--ha-muted);text-decoration:line-through}#zamak-planning .ha-closed-label{color:var(--ha-orange);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#zamak-planning .ha-legend{padding:12px;display:flex;gap:10px 13px;flex-wrap:wrap;font-size:11px;color:var(--ha-muted)}#zamak-planning .ha-legend>span{display:flex;align-items:center;gap:5px}#zamak-planning .ha-dot{display:inline-block;flex-shrink:0;width:7px;height:7px;border-radius:2px;background:var(--ha-accent)}#zamak-planning .ha-dot.exceptional{background:var(--ha-purple)}#zamak-planning .ha-dot.closure{background:var(--ha-orange)}#zamak-planning .ha-dot.blocked{background:var(--ha-muted)}#zamak-planning .ha-sidebar{display:flex;flex-direction:column;gap:14px;min-width:0}#zamak-planning .ha-panel{border:1px solid var(--ha-border);border-radius:10px;padding:16px;background:var(--ha-surface);min-width:0}#zamak-planning .ha-panel-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:12px}#zamak-planning .ha-panel .ha-eyebrow{font-size:11px;color:var(--ha-muted);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:4px}#zamak-planning .ha-launch{padding:13px 0;border-top:1px solid var(--ha-border)}#zamak-planning .ha-launchhead{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:500}#zamak-planning .ha-time{font-variant-numeric:tabular-nums;white-space:nowrap}#zamak-planning .ha-launch p{font-size:12px;color:var(--ha-muted);margin-top:3px}#zamak-planning .ha-badge{display:inline-block;padding:3px 7px;border-radius:5px;background:var(--ha-accent-soft);color:var(--ha-accent);font-size:11px;margin-top:8px;font-weight:500}#zamak-planning .ha-badge.exceptional{background:var(--ha-purple-soft);color:var(--ha-purple)}#zamak-planning .ha-badge.cancelled{background:var(--ha-inset);color:var(--ha-muted)}#zamak-planning .ha-rowactions{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px}#zamak-planning .ha-textbutton{background:transparent;border:0;padding:3px 0;color:var(--ha-accent);font-size:12px;font-weight:500;text-align:left}#zamak-planning .ha-textbutton.danger{color:var(--ha-error)}#zamak-planning .ha-rule{display:flex;gap:8px;color:var(--ha-muted);font-size:12px;padding:0 3px}#zamak-planning .ha-rule svg{width:16px;height:16px;margin-top:1px}#zamak-planning .ha-closure-item{padding-top:12px;border-top:1px solid var(--ha-border);margin-top:12px}#zamak-planning .ha-closure-item:first-of-type{margin-top:0}#zamak-planning .ha-closure-item h3{color:var(--ha-orange);font-size:14px}#zamak-planning .ha-closure-item p{font-size:12px;color:var(--ha-muted);margin-top:5px}#zamak-planning .ha-field{display:flex;flex-direction:column;gap:5px;margin-bottom:13px;font-size:12px;font-weight:500}#zamak-planning .ha-field input,#zamak-planning .ha-field select{padding:9px 10px;border:1px solid var(--ha-border);border-radius:6px;background:var(--ha-bg);color:var(--ha-text);width:100%;min-width:0;font-size:14px;font-weight:400}#zamak-planning .ha-fieldpair{display:grid;grid-template-columns:minmax(0,1fr) 94px;gap:9px}#zamak-planning .ha-check{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--ha-muted);margin:2px 0 14px}#zamak-planning .ha-check input{margin-top:3px;accent-color:var(--ha-accent)}#zamak-planning .ha-editor .ha-actions{margin-top:15px}#zamak-planning .ha-summary{padding:12px;background:var(--ha-accent-soft);border-radius:7px;font-size:12px;overflow-wrap:anywhere}#zamak-planning .ha-summary strong{display:block;font-weight:500;font-size:14px;margin-bottom:5px}#zamak-planning .ha-error{background:var(--ha-error-soft);color:var(--ha-error);padding:10px;border-radius:6px;font-size:12px;margin-top:12px}#zamak-planning .ha-feedback{color:var(--ha-accent);font-size:12px;min-height:18px;margin-top:12px}#zamak-planning .ha-footer{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;color:var(--ha-muted);font-size:11px;padding-top:12px;border-top:1px solid var(--ha-border);margin-top:10px}#zamak-planning .ha-footer>span:first-child{display:flex;gap:6px;align-items:center}#zamak-planning .ha-footer svg{width:13px;height:13px}#zamak-planning .ha-weekly-head{margin-bottom:18px}#zamak-planning .ha-weekly-head p{margin-top:5px}#zamak-planning .ha-weeklyrow{display:grid;grid-template-columns:1fr 145px 115px auto;gap:16px;align-items:center;padding:18px;background:var(--ha-surface);border:1px solid var(--ha-border);border-radius:10px;margin-bottom:12px}#zamak-planning .ha-weeklyrow .ha-field{margin:0}#zamak-planning .ha-empty{padding:12px 0;color:var(--ha-muted);font-size:12px}#zamak-planning .ha-mobile-events{display:none}\n@media(max-width:860px){#zamak-planning .ha-main{padding:18px}#zamak-planning .ha-workspace{grid-template-columns:minmax(0,1fr) 255px;gap:12px}#zamak-planning .ha-day{min-height:84px}#zamak-planning .ha-dayevent{padding:2px;font-size:11px}#zamak-planning .ha-appbar{padding-left:18px}}\n@media(max-width:700px){#zamak-planning .ha-workspace{grid-template-columns:1fr}#zamak-planning .ha-sidebar{display:grid;grid-template-columns:1fr 1fr;align-items:start}#zamak-planning .ha-sidebar>.ha-rule{grid-column:1/-1}#zamak-planning .ha-preview{display:none}#zamak-planning .ha-weeklyrow{grid-template-columns:1fr 1fr}#zamak-planning .ha-weeklyrow>div:first-child{grid-column:1/-1}#zamak-planning .ha-weeklyrow>.ha-check{grid-column:1/-1}}\n@media(max-width:440px){#zamak-planning .ha-appbar{padding:14px 12px;padding-right:80px}#zamak-planning .ha-brand{gap:7px;font-size:12px}#zamak-planning .ha-brand span:last-child{display:none}#zamak-planning .ha-slash{display:none}#zamak-planning .ha-main{padding:14px 10px}#zamak-planning h1{font-size:23px}#zamak-planning .ha-actions{width:100%}#zamak-planning .ha-heading .ha-actions .ha-button{width:100%;justify-content:flex-start}#zamak-planning .ha-sidebar{grid-template-columns:1fr}#zamak-planning .ha-day{min-height:73px;padding:5px 2px}#zamak-planning .ha-date{font-size:11px;min-width:20px;line-height:20px}#zamak-planning .ha-dayevent{display:none}#zamak-planning .ha-mobile-events{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-top:6px}#zamak-planning .ha-closed-label{font-size:11px}#zamak-planning .ha-day.closed .ha-closed-label{font-size:0}#zamak-planning .ha-day.closed .ha-closed-label:after{content:'Fermé';font-size:11px}#zamak-planning .ha-legend{gap:8px 12px}#zamak-planning .ha-footer{gap:5px}#zamak-planning .ha-field input,#zamak-planning .ha-field select{font-size:16px}}\n@media(pointer:coarse){#zamak-planning .ha-iconbutton{width:44px;height:44px}#zamak-planning .ha-button,#zamak-planning .ha-textbutton,#zamak-planning .ha-tabs button{min-height:44px}}\n\n:host{display:block;color-scheme:light}:host([dark]){color-scheme:dark}ha-card{overflow:hidden}#zamak-planning{border:0;border-radius:var(--ha-card-border-radius,12px);--ha-bg:var(--primary-background-color);--ha-surface:var(--card-background-color);--ha-text:var(--primary-text-color);--ha-muted:var(--secondary-text-color);--ha-border:var(--divider-color);--ha-accent:var(--primary-color);--ha-accent-text:var(--text-primary-color,#fff)}#zamak-planning .ha-error:empty,#zamak-planning .ha-feedback:empty{display:none}#zamak-planning .ha-top-error{margin-bottom:15px}#zamak-planning .ha-panel button{max-width:100%}#zamak-planning .ha-weeklyrow{grid-template-columns:1fr auto}#zamak-planning .ha-note{margin-top:8px}#zamak-planning .ha-settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}#zamak-planning .ha-wide{grid-column:1/-1}#zamak-planning .ha-confirm-delete{margin-top:12px;padding-top:12px;border-top:1px solid var(--ha-border)}#zamak-planning .ha-list-empty{min-height:70px}#zamak-planning .ha-button:disabled{pointer-events:none}#zamak-planning .ha-weeklyrow p{margin-top:5px}@media(max-width:440px){#zamak-planning .ha-settings{grid-template-columns:1fr}#zamak-planning .ha-weeklyrow{grid-template-columns:1fr}#zamak-planning .ha-weeklyrow .ha-actions{justify-content:flex-start}}";

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

class PlanningChauffeCard extends HTMLElement {
  static getConfigElement() { return document.createElement('ha-planning-chauffe-card-editor'); }
  static getStubConfig() { return { type: 'custom:ha-planning-chauffe-card', title: 'Planning de chauffe', demo: true }; }
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
  getCardSize() { return 12; }
  getGridOptions() { return { columns: 'full', rows: 'auto', min_columns: 6 }; }
  _q(selector) { return this.shadowRoot.querySelector(selector); }
  _initialize() {
    this._zone = this._hass.config?.time_zone || 'Europe/Brussels';
    this._selected = dayOf(Date.now(), this._zone); this._month = this._selected.slice(0, 7);
    this._initialized = true; this._events = []; this._editor = null;
    if (this._config.demo) {
      const demo = demoEvents(this._config, this._zone);
      this._events = demo.events; this._selected = demo.selected; this._loaded = true; this._render();
    } else { this._render(); this._load(); }
  }
  _calendar(index) { return this._config.demo ? `calendar.demo_group_${index}` : this._config.groups[index].calendar; }
  _closureCalendar() { return this._config.demo ? 'calendar.demo_closures' : this._config.closure_calendar; }
  _name(event) { return event.role === 'closure' ? event.summary : this._config.groups[event.groupIndex]?.name || event.summary; }
  _date(instant, options = {}) { return new Intl.DateTimeFormat('fr-BE', { timeZone: this._zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...options }).format(new Date(instant)); }
  _dayLabel(day) { return new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00Z`)); }
  _status(event) { return eventStatus(event, this._events, this._zone); }
  _statusText(event) {
    return ({ closure: 'Fermeture', external: 'Événement non piloté', closed: 'Bloqué par fermeture', replaced: 'Remplacé pour cette reprise' })[this._status(event)] || (event.meta?.kind === 'restart' ? 'Reprise ponctuelle' : 'Horaire habituel');
  }
  _editable(event) { return !!event.uid && !!event.meta && (!event.rrule || event.meta.kind === 'weekly'); }
  _canWrite() { return this._config.demo || (this._loaded && !this._error && !this._loading); }
  async _fetch(startDay, endDay) {
    const sources = [{ calendar: this._closureCalendar(), role: 'closure', index: null }, ...this._config.groups.map((g, i) => ({ calendar: this._calendar(i), role: 'group', index: i }))];
    const query = new URLSearchParams({ start: toInstant(`${startDay}T00:00`, this._zone), end: toInstant(`${endDay}T00:00`, this._zone) });
    const results = await Promise.all(sources.map(async source => {
      const entity = this._hass.states[source.calendar];
      if (!entity || !['on', 'off'].includes(entity.state)) throw new Error(`Calendrier indisponible : ${source.calendar}.`);
      if ((Number(entity.attributes.supported_features) & 7) !== 7) throw new Error(`Le calendrier ${source.calendar} ne permet pas toutes les modifications. Utilisez Calendrier local.`);
      const rows = await this._hass.callApi('GET', `calendars/${source.calendar}?${query}`);
      if (!Array.isArray(rows)) throw new Error('Réponse calendrier invalide.');
      return rows.map(e => normalizeEvent(e, source.calendar, source.role, source.index, this._zone));
    }));
    return results.flat();
  }
  async _load() {
    if (this._config.demo || this._loading) return;
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
    this.shadowRoot.innerHTML = `<style>${STYLES}ha-icon{--mdc-icon-size:18px}.ha-review-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}</style><ha-card><div id="zamak-planning"><main class="ha-main">
      <div class="ha-heading"><div><h1>${esc(this._config.title)}</h1><p class="ha-secondary">Horaires habituels, fermetures et reprises exceptionnelles.</p></div><div class="ha-actions">${this._button('Ajouter une fermeture', 'new-closure', true, disabled)}${this._button('Programmer une reprise', 'new-restart', false, disabled)}</div></div>
      <div class="ha-demo"><ha-icon icon="mdi:${this._config.demo ? 'flask-outline' : 'calendar-check'}"></ha-icon><span>${this._config.demo ? 'Démonstration · aucune connexion aux calendriers ou aux machines' : 'Calendriers Home Assistant · exécution selon les automatisations configurées'}</span></div>
      ${this._error ? `<div class="ha-error ha-top-error" role="alert">${esc(this._error)} Les modifications sont bloquées. ${this._button('Réessayer', 'refresh', true)}</div>` : ''}
      <div class="ha-tabs" role="tablist" aria-label="Vues du planning"><button type="button" role="tab" id="calendar-tab" aria-controls="calendar-panel" aria-selected="${this._view === 'calendar'}" data-view="calendar">Calendrier</button><button type="button" role="tab" id="weekly-tab" aria-controls="weekly-panel" aria-selected="${this._view === 'weekly'}" data-view="weekly">Horaires habituels</button></div>
      <section id="calendar-panel" role="tabpanel" aria-labelledby="calendar-tab" ${this._view !== 'calendar' ? 'hidden' : ''}><div class="ha-workspace"><section class="ha-calendar" aria-label="Calendrier de chauffe">${this._calendarHtml()}</section><aside class="ha-sidebar">${this._editor ? this._editorHtml() : this._detailsHtml()}${this._closuresHtml()}<div class="ha-rule"><ha-icon icon="mdi:shield-check-outline"></ha-icon><span>Une fermeture bloque tous les démarrages. Sa fin ne démarre aucune machine.</span></div></aside></div></section>
      <section id="weekly-panel" role="tabpanel" aria-labelledby="weekly-tab" ${this._view !== 'weekly' ? 'hidden' : ''}>${this._weeklyHtml()}</section>
      <div class="ha-feedback" role="status" aria-live="polite">${esc(this._message)}</div>
      <footer class="ha-footer"><span>${this._config.demo ? 'Simulation uniquement' : 'Les calendriers sont partagés entre les utilisateurs.'}</span><span>v${VERSION} · ${esc(this._zone)}</span></footer>
      </main></div></ha-card>`;
  }
  _calendarHtml() {
    const range = viewRange(this._month);
    const month = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${this._month}-01T12:00:00Z`));
    let html = `<div class="ha-monthbar"><div class="ha-month-title"><h2>${esc(month.charAt(0).toUpperCase() + month.slice(1))}</h2><span class="ha-secondary">${this._loading ? 'Actualisation…' : esc(this._zone)}</span></div><div class="ha-monthnav"><button type="button" class="ha-iconbutton" data-action="refresh" aria-label="Actualiser">↻</button><button type="button" class="ha-iconbutton" data-action="prev-month" aria-label="Mois précédent">‹</button><button type="button" class="ha-iconbutton" data-action="next-month" aria-label="Mois suivant">›</button></div></div><div class="ha-days" aria-hidden="true">${['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'].map(d => `<span>${d}</span>`).join('')}</div><div class="ha-monthgrid">`;
    for (let i = 0; i < range.count; i++) {
      const day = shiftDay(range.start, i);
      const events = this._events.filter(e => e.role === 'group' && dayOf(e.start, this._zone) === day).sort((a, b) => a.start.localeCompare(b.start));
      const closed = this._events.some(e => e.role === 'closure' && e.start < toInstant(`${shiftDay(day, 1)}T00:00`, this._zone) && e.end > toInstant(`${day}T00:00`, this._zone));
      const summary = `${this._dayLabel(day)}${closed ? ', fermeture au moins partielle' : ''}${events.map(e => `, ${this._name(e)} ${localMinute(e.start, this._zone).slice(11)}, ${this._statusText(e)}`).join('')}`;
      html += `<button type="button" class="ha-day ${day.slice(0, 7) !== this._month ? 'outside' : ''} ${closed ? 'closed' : ''} ${day === this._selected ? 'selected' : ''}" data-day="${day}" aria-label="${esc(summary)}" aria-pressed="${day === this._selected}"><span class="ha-date">${Number(day.slice(8))}</span>${closed ? '<span class="ha-closed-label">Fermeture</span>' : ''}${events.slice(0, 3).map(e => `<span class="ha-dayevent ${['closed', 'replaced', 'external'].includes(this._status(e)) ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}">${esc(localMinute(e.start, this._zone).slice(11))} ${esc(this._name(e))}</span>`).join('')}${events.length > 3 ? `<span class="ha-secondary">+${events.length - 3}</span>` : ''}<span class="ha-mobile-events">${events.slice(0, 6).map(e => `<b class="ha-dot ${['closed','replaced','external'].includes(this._status(e)) ? 'blocked' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}"></b>`).join('')}</span></button>`;
    }
    return html + '</div><div class="ha-legend"><span><b class="ha-dot regular"></b>Habituel</span><span><b class="ha-dot exceptional"></b>Reprise ponctuelle</span><span><b class="ha-dot closure"></b>Fermeture</span><span><b class="ha-dot blocked"></b>Bloqué / remplacé</span></div>';
  }
  _detailsHtml() {
    const events = this._events.filter(e => e.role === 'group' && dayOf(e.start, this._zone) === this._selected).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel" aria-live="polite"><div class="ha-panel-title"><div><span class="ha-eyebrow">Démarrages prévus</span><h2>${esc(this._dayLabel(this._selected))}</h2></div></div>${!events.length ? '<p class="ha-empty">Aucun démarrage prévu ce jour.</p>' : ''}${events.map(e => `<article class="ha-launch"><div class="ha-launchhead"><span>${esc(this._name(e))}</span><span class="ha-time">${esc(localMinute(e.start, this._zone).slice(11))}</span></div><span class="ha-badge ${this._status(e) !== 'planned' ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : ''}">${this._statusText(e)}</span>${e.meta?.note ? `<p>${esc(e.meta.note)}</p>` : ''}${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier${e.meta.kind === 'weekly' ? ' la série' : ''}</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>${e.meta.kind === 'weekly' ? 'Supprimer la série' : 'Annuler la reprise'}</button></div>` : ''}</article>`).join('')}<button type="button" class="ha-textbutton" data-action="new-restart" ${!this._canWrite() ? 'disabled' : ''}>+ Ajouter un démarrage ce jour</button></section>`;
  }
  _closuresHtml() {
    const closures = this._events.filter(e => e.role === 'closure' && e.end > toInstant(`${viewRange(this._month).start}T00:00`, this._zone)).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel"><div class="ha-panel-title"><h3>Fermetures planifiées</h3></div>${!closures.length ? '<p class="ha-empty">Aucune fermeture sur la période affichée.</p>' : ''}${closures.map(e => `<article class="ha-closure-item"><h3>${esc(e.summary)}</h3><p>Du ${esc(this._date(e.start))}<br>au ${esc(this._date(e.end))}</p><span class="ha-badge cancelled">Démarrages bloqués</span>${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button></div>` : '<p>Géré depuis le calendrier Home Assistant.</p>'}</article>`).join('')}</section>`;
  }
  _weeklyHtml() {
    return `<div class="ha-weekly-head"><h2>Semaine habituelle</h2><p class="ha-secondary">Cycle de production du dimanche au samedi. Une reprise peut remplacer l’horaire de ce cycle.</p></div>${this._config.groups.map((g, i) => {
      const found = this._events.find(e => e.groupIndex === i && e.meta?.kind === 'weekly');
      return `<article class="ha-weeklyrow"><div><h3>${esc(g.name)}</h3><p class="ha-secondary">${found ? esc(new Intl.DateTimeFormat('fr-BE', { timeZone: this._zone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(found.start))) : 'Aucun horaire sur la période affichée.'}</p></div><div class="ha-actions">${found ? `<button type="button" class="ha-button" data-edit="${esc(found.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier la série</button><button type="button" class="ha-textbutton danger" data-delete="${esc(found.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button>` : `<button type="button" class="ha-button" data-weekly="${i}" ${!this._canWrite() ? 'disabled' : ''}>Ajouter un horaire</button>`}</div></article>`;
    }).join('')}`;
  }
  _field(label, name, type, value) { return `<label class="ha-field">${label}<input type="${type}" name="${name}" value="${esc(value)}" required ${this._busy ? 'disabled' : ''}></label>`; }
  _editorHtml() {
    const d = this._draft, editing = !!d.uid;
    const title = this._editor === 'delete' ? 'Confirmer la suppression' : `${editing ? 'Modifier' : 'Programmer'} ${d.kind === 'closure' ? 'une fermeture' : d.kind === 'weekly' ? 'un horaire habituel' : 'une reprise'}`;
    let html = `<section class="ha-panel ha-editor" aria-label="Formulaire de programmation"><div class="ha-panel-title"><h3>${title}</h3><button type="button" class="ha-iconbutton" data-action="close-editor" aria-label="Fermer" ${this._busy ? 'disabled' : ''}>×</button></div>`;
    if (this._editor === 'review' || this._editor === 'delete') {
      html += `<div class="ha-summary"><strong>${esc(d.summary)}</strong>${this._editor === 'delete' ? (d.kind === 'weekly' ? 'Toute la série hebdomadaire sera supprimée.' : 'Cet événement sera supprimé du calendrier.') : d.kind === 'closure' ? `Du ${esc(this._date(d.start))} au ${esc(this._date(d.end))}. Les démarrages pendant cette période seront bloqués.` : `${esc(this._date(d.start))}${d.kind === 'weekly' ? ' · toutes les semaines' : d.replace ? '<br>Remplace l’horaire habituel de ce groupe pour ce cycle.' : '<br>Ajoute un démarrage ponctuel.'}`}</div>${this._editor === 'review' && d.uid && d.kind === 'weekly' ? '<p class="ha-secondary ha-note">Cette modification concerne toute la série hebdomadaire.</p>' : ''}<div class="ha-review-buttons">${this._button(this._busy ? 'Enregistrement…' : this._config.demo ? 'Confirmer dans la démo' : 'Confirmer dans Home Assistant', this._editor === 'delete' ? 'confirm-delete' : 'save')}${this._button('Retour', 'back', true)}</div>`;
    } else {
      html += '<form><div class="ha-settings">';
      if (d.kind === 'closure') html += `<div class="ha-wide">${this._field('Nom de la fermeture', 'summary', 'text', d.summary)}${this._field('Début de fermeture', 'start', 'datetime-local', localMinute(d.start, this._zone))}${this._field('Fin de fermeture', 'end', 'datetime-local', localMinute(d.end, this._zone))}</div>`;
      else {
        html += `<label class="ha-field ha-wide">Groupe de machines<select name="group" ${editing ? 'disabled' : ''}>${this._config.groups.map((g, i) => `<option value="${i}" ${i === d.groupIndex ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>`;
        if (d.kind === 'weekly') html += `<label class="ha-field">Jour<select name="day">${['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map((name, i) => `<option value="${i}" ${i === weekday(dayOf(d.start, this._zone)) ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
        else html += this._field('Date', 'date', 'date', dayOf(d.start, this._zone));
        html += this._field('Heure', 'time', 'time', localMinute(d.start, this._zone).slice(11));
        if (d.kind === 'restart') html += `<label class="ha-check ha-wide"><input type="checkbox" name="replace" ${d.replace ? 'checked' : ''}>Remplacer le démarrage habituel pour cette reprise</label>`;
      }
      html += `<label class="ha-field ha-wide">Note (facultative)<input type="text" name="note" maxlength="500" value="${esc(d.note || '')}"></label></div>${!this._config.demo && d.kind !== 'closure' ? `<p class="ha-secondary">Prévoir au moins ${MIN_LEAD_MINUTES} minutes. Heure du site : ${esc(this._zone)}.</p>` : ''}<div class="ha-review-buttons">${this._button('Vérifier la programmation', 'review')}${this._button('Annuler', 'close-editor', true)}</div></form>`;
    }
    return html + `${this._formError ? `<div class="ha-error" role="alert">${esc(this._formError)}</div>` : ''}</section>`;
  }
  _open(kind, event, index = 0) {
    if (!this._canWrite() || this._busy) return;
    this._view = 'calendar'; this._message = ''; this._formError = ''; this._original = event || null;
    const soon = Date.now() + 30 * 60000;
    let start = event?.start || toInstant(`${this._selected}T06:00`, this._zone);
    if (!event && !this._config.demo && Date.parse(start) < soon) start = new Date(Math.ceil(soon / 60000) * 60000).toISOString();
    if (kind === 'weekly' && !event) start = nextWeekly(DEFAULT_GROUPS[index]?.day ?? 1, DEFAULT_GROUPS[index]?.time || '01:00', this._zone);
    this._draft = event ? { ...event, kind: event.meta.kind, note: event.meta.note || '', replace: event.meta.replace === true, event_id: event.meta.id } : { kind, groupIndex: index, calendar: kind === 'closure' ? this._closureCalendar() : this._calendar(index), start, end: new Date(Date.parse(start) + (kind === 'closure' ? 14 * 86400000 : 300000)).toISOString(), summary: kind === 'closure' ? 'Fermeture atelier' : this._config.groups[index].name, replace: true, event_id: newEventId() };
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
        if (!d.uid) d.groupIndex = Number(data.get('group'));
        d.calendar = this._calendar(d.groupIndex);
        d.start = d.kind === 'weekly' ? nextWeekly(Number(data.get('day')), data.get('time'), this._zone) : toInstant(`${data.get('date')}T${data.get('time')}`, this._zone);
        d.end = new Date(Date.parse(d.start) + 300000).toISOString();
        d.summary = `${d.kind === 'weekly' ? 'Chauffe habituelle' : 'Reprise'} · ${this._config.groups[d.groupIndex].name}`;
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
      this._message = `${remove ? 'Événement supprimé.' : 'Programmation enregistrée.'}${this._config.demo ? ' Démonstration uniquement.' : ' Aucun relais n’est commandé par la carte.'}`;
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
      for (let date = range.queryStart; date < shiftDay(range.queryEnd, 30); date = shiftDay(date, 1)) if (weekday(date) === day) add(toInstant(`${date}T${time}`, this._zone));
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
      case 'refresh': if (!this._config.demo) await this._load(); else { this._message = 'Démonstration locale, sans appel à Home Assistant.'; this._render(); } break;
      case 'prev-month': case 'next-month': {
        if (this._loading) return;
        const date = new Date(`${this._month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + (button.dataset.action === 'next-month' ? 1 : -1));
        this._month = date.toISOString().slice(0, 7); this._editor = null; this._render(); if (!this._config.demo) await this._load(); break;
      }
    }
  }
}
if (!customElements.get('ha-planning-chauffe-card')) customElements.define('ha-planning-chauffe-card', PlanningChauffeCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'ha-planning-chauffe-card')) window.customCards.push({ type: 'ha-planning-chauffe-card', name: 'Planning de chauffe', description: 'Calendriers de chauffe, fermetures et reprises exceptionnelles. Démonstration sans appareils par défaut.', preview: true, documentationURL: 'https://github.com/Euro-Locks-Belgium/ha-planning-chauffe-card' });

})();
