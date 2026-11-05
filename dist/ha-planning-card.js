/* Planning 0.4.0 | Euro-Locks Belgium */
(() => {
'use strict';
const VERSION = "0.4.0";
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
  config.devices = (input.devices || []).map(d => ({ id: String(d.id || '').trim(), name: String(d.name || '').trim() }));
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
function validateDraft(draft, events, zone, now = Date.now(), demo = false) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un libellé à la période d’exclusion.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Cette programmation se trouve pendant une exclusion. Modifiez la date ou l’exclusion.';
  if (draft.color && !/^#[0-9a-f]{6}$/i.test(draft.color)) return 'Choisissez une couleur valide.';
  if (draft.devices !== undefined && (!Array.isArray(draft.devices) || !draft.devices.length || draft.devices.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)) || new Set(draft.devices).size !== draft.devices.length)) return 'Sélectionnez au moins un appareil valide.';
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
function viewRange(month) {
  const first = `${month}-01`, start = shiftDay(first, -((weekday(first) + 6) % 7));
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const days = Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(first)) / 86400000);
  const count = Math.ceil((((weekday(first) + 6) % 7) + days) / 7) * 7;
  return { start, end: shiftDay(start, count), count, queryStart: shiftDay(start, -7), queryEnd: shiftDay(start, count + 7) };
}
function emptyLocalState(zone, now = Date.now()) {
  return { events: [], selected: dayOf(now, zone) };
}

const STYLES = "\n#planning-root{--ha-bg:light-dark(#f5f6f8,#111315);--ha-surface:light-dark(#fff,#1d1f21);--ha-text:light-dark(#18252c,#e8edf0);--ha-muted:light-dark(#53636d,#a6b2bb);--ha-border:light-dark(#dce3e8,#363b40);--ha-accent:light-dark(#006e8c,#32c5eb);--ha-accent-text:light-dark(#fff,#002c39);--ha-accent-soft:light-dark(#e7f6fb,#17353d);--ha-purple:light-dark(#7251a8,#c3a5f1);--ha-purple-soft:light-dark(#f1ecfa,#30263f);--ha-orange:light-dark(#8c4c09,#f0bb73);--ha-orange-soft:light-dark(#fff2df,#3b3021);--ha-error:light-dark(#b52f3f,#ffadb5);--ha-error-soft:light-dark(#fff0f0,#3c2429);--ha-inset:light-dark(#edf1f4,#292d31);color:var(--ha-text);background:var(--ha-bg);font:14px/1.45 \"Segoe UI\",Arial,sans-serif;border:1px solid var(--ha-border);border-radius:14px;overflow:hidden;position:relative;isolation:isolate;color-scheme:inherit}\n#planning-root *{box-sizing:border-box}#planning-root [hidden]{display:none!important}#planning-root h1,#planning-root h2,#planning-root h3,#planning-root p{margin:0}#planning-root h1{font-size:25px;font-weight:500;letter-spacing:-.6px}#planning-root h2{font-size:17px;font-weight:500}#planning-root h3{font-size:15px;font-weight:500}#planning-root button,#planning-root input,#planning-root select{font:inherit}#planning-root button{color:inherit}#planning-root button:focus-visible,#planning-root input:focus-visible,#planning-root select:focus-visible{outline:2px solid var(--ha-accent);outline-offset:3px}#planning-root svg{width:18px;height:18px;flex-shrink:0}#planning-root .ha-secondary{color:var(--ha-muted);font-size:12px}#planning-root .ha-appbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 24px;background:var(--ha-surface);border-bottom:1px solid var(--ha-border);padding-right:108px}#planning-root .ha-brand{display:flex;gap:10px;align-items:center;font-weight:500;flex-wrap:wrap}#planning-root .ha-brand>svg{color:var(--ha-accent)}#planning-root .ha-slash{color:var(--ha-muted);font-weight:400}#planning-root .ha-preview{color:var(--ha-muted);font-size:12px;white-space:nowrap}#planning-root .ha-main{padding:24px}#planning-root .ha-heading{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}#planning-root .ha-heading p{margin-top:5px}#planning-root .ha-actions{display:flex;gap:8px;flex-wrap:wrap}#planning-root .ha-button{display:inline-flex;gap:7px;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:8px;background:var(--ha-surface);padding:10px 13px;min-height:40px;font-weight:500;white-space:normal;text-align:center}#planning-root .ha-button:hover{background:var(--ha-inset)}#planning-root .ha-primary{background:var(--ha-accent);border-color:var(--ha-accent);color:var(--ha-accent-text)}#planning-root .ha-primary:hover{background:var(--ha-accent);filter:brightness(.95)}#planning-root .ha-button:disabled{opacity:.45;cursor:not-allowed}#planning-root .ha-small{font-size:12px;padding:7px 9px;min-height:32px}#planning-root .ha-iconbutton{background:transparent;border:1px solid var(--ha-border);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:7px}#planning-root .ha-demo{display:flex;gap:8px;align-items:center;color:var(--ha-muted);font-size:12px;margin:18px 0 14px}#planning-root .ha-demo svg{width:15px;height:15px}#planning-root .ha-tabs{display:flex;gap:22px;border-bottom:1px solid var(--ha-border);margin-bottom:20px}#planning-root .ha-tabs button{border:0;border-bottom:2px solid transparent;padding:10px 0;background:transparent;color:var(--ha-muted);font-weight:500}#planning-root .ha-tabs button[aria-selected=true]{color:var(--ha-accent);border-bottom-color:var(--ha-accent)}#planning-root .ha-workspace{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}#planning-root .ha-calendar{border:1px solid var(--ha-border);border-radius:10px;background:var(--ha-surface);overflow:hidden;min-width:0}#planning-root .ha-monthbar{padding:15px;display:flex;justify-content:space-between;gap:8px;align-items:center}#planning-root .ha-month-title{display:flex;flex-direction:column;gap:2px}#planning-root .ha-monthnav{display:flex;gap:6px}#planning-root .ha-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));text-align:right;color:var(--ha-muted);font-size:11px;padding:0 7px 8px}#planning-root .ha-days span{padding-right:6px}#planning-root .ha-monthgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--ha-border)}#planning-root .ha-day{background:var(--ha-surface);border:0;border-right:1px solid var(--ha-border);border-bottom:1px solid var(--ha-border);min-height:91px;min-width:0;display:flex;flex-direction:column;gap:3px;padding:6px 4px;text-align:left;position:relative}#planning-root .ha-day:nth-child(7n){border-right:0}#planning-root .ha-day:hover{background:var(--ha-inset)}#planning-root .ha-day.outside{color:var(--ha-muted);background:var(--ha-bg)}#planning-root .ha-day.closed{background:var(--ha-orange-soft)}#planning-root .ha-day.selected{box-shadow:inset 0 0 0 2px var(--ha-accent);z-index:1}#planning-root .ha-date{align-self:flex-end;min-width:23px;text-align:center;font-size:12px;line-height:23px;border-radius:50%}#planning-root .ha-day.selected .ha-date{background:var(--ha-accent);color:var(--ha-accent-text)}#planning-root .ha-dayevent{display:block;border-radius:3px;padding:2px 4px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;background:var(--ha-accent-soft);color:var(--ha-accent);font-weight:500}#planning-root .ha-dayevent.exceptional{background:var(--ha-purple-soft);color:var(--ha-purple)}#planning-root .ha-dayevent.cancelled{background:var(--ha-inset);color:var(--ha-muted);text-decoration:line-through}#planning-root .ha-closed-label{color:var(--ha-orange);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#planning-root .ha-legend{padding:12px;display:flex;gap:10px 13px;flex-wrap:wrap;font-size:11px;color:var(--ha-muted)}#planning-root .ha-legend>span{display:flex;align-items:center;gap:5px}#planning-root .ha-dot{display:inline-block;flex-shrink:0;width:7px;height:7px;border-radius:2px;background:var(--ha-accent)}#planning-root .ha-dot.exceptional{background:var(--ha-purple)}#planning-root .ha-dot.closure{background:var(--ha-orange)}#planning-root .ha-dot.blocked{background:var(--ha-muted)}#planning-root .ha-sidebar{display:flex;flex-direction:column;gap:14px;min-width:0}#planning-root .ha-panel{border:1px solid var(--ha-border);border-radius:10px;padding:16px;background:var(--ha-surface);min-width:0}#planning-root .ha-panel-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:12px}#planning-root .ha-panel .ha-eyebrow{font-size:11px;color:var(--ha-muted);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:4px}#planning-root .ha-launch{padding:13px 0;border-top:1px solid var(--ha-border)}#planning-root .ha-launchhead{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:500}#planning-root .ha-time{font-variant-numeric:tabular-nums;white-space:nowrap}#planning-root .ha-launch p{font-size:12px;color:var(--ha-muted);margin-top:3px}#planning-root .ha-badge{display:inline-block;padding:3px 7px;border-radius:5px;background:var(--ha-accent-soft);color:var(--ha-accent);font-size:11px;margin-top:8px;font-weight:500}#planning-root .ha-badge.exceptional{background:var(--ha-purple-soft);color:var(--ha-purple)}#planning-root .ha-badge.cancelled{background:var(--ha-inset);color:var(--ha-muted)}#planning-root .ha-rowactions{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px}#planning-root .ha-textbutton{background:transparent;border:0;padding:3px 0;color:var(--ha-accent);font-size:12px;font-weight:500;text-align:left}#planning-root .ha-textbutton.danger{color:var(--ha-error)}#planning-root .ha-rule{display:flex;gap:8px;color:var(--ha-muted);font-size:12px;padding:0 3px}#planning-root .ha-rule svg{width:16px;height:16px;margin-top:1px}#planning-root .ha-closure-item{padding-top:12px;border-top:1px solid var(--ha-border);margin-top:12px}#planning-root .ha-closure-item:first-of-type{margin-top:0}#planning-root .ha-closure-item h3{color:var(--ha-orange);font-size:14px}#planning-root .ha-closure-item p{font-size:12px;color:var(--ha-muted);margin-top:5px}#planning-root .ha-field{display:flex;flex-direction:column;gap:5px;margin-bottom:13px;font-size:12px;font-weight:500}#planning-root .ha-field input,#planning-root .ha-field select{padding:9px 10px;border:1px solid var(--ha-border);border-radius:6px;background:var(--ha-bg);color:var(--ha-text);width:100%;min-width:0;font-size:14px;font-weight:400}#planning-root .ha-fieldpair{display:grid;grid-template-columns:minmax(0,1fr) 94px;gap:9px}#planning-root .ha-check{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--ha-muted);margin:2px 0 14px}#planning-root .ha-check input{margin-top:3px;accent-color:var(--ha-accent)}#planning-root .ha-editor .ha-actions{margin-top:15px}#planning-root .ha-summary{padding:12px;background:var(--ha-accent-soft);border-radius:7px;font-size:12px;overflow-wrap:anywhere}#planning-root .ha-summary strong{display:block;font-weight:500;font-size:14px;margin-bottom:5px}#planning-root .ha-error{background:var(--ha-error-soft);color:var(--ha-error);padding:10px;border-radius:6px;font-size:12px;margin-top:12px}#planning-root .ha-feedback{color:var(--ha-accent);font-size:12px;min-height:18px;margin-top:12px}#planning-root .ha-footer{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;color:var(--ha-muted);font-size:11px;padding-top:12px;border-top:1px solid var(--ha-border);margin-top:10px}#planning-root .ha-footer>span:first-child{display:flex;gap:6px;align-items:center}#planning-root .ha-footer svg{width:13px;height:13px}#planning-root .ha-weekly-head{margin-bottom:18px}#planning-root .ha-weekly-head p{margin-top:5px}#planning-root .ha-weeklyrow{display:grid;grid-template-columns:1fr 145px 115px auto;gap:16px;align-items:center;padding:18px;background:var(--ha-surface);border:1px solid var(--ha-border);border-radius:10px;margin-bottom:12px}#planning-root .ha-weeklyrow .ha-field{margin:0}#planning-root .ha-empty{padding:12px 0;color:var(--ha-muted);font-size:12px}#planning-root .ha-mobile-events{display:none}\n@media(max-width:860px){#planning-root .ha-main{padding:18px}#planning-root .ha-workspace{grid-template-columns:minmax(0,1fr) 255px;gap:12px}#planning-root .ha-day{min-height:84px}#planning-root .ha-dayevent{padding:2px;font-size:11px}#planning-root .ha-appbar{padding-left:18px}}\n@media(max-width:700px){#planning-root .ha-workspace{grid-template-columns:1fr}#planning-root .ha-sidebar{display:grid;grid-template-columns:1fr 1fr;align-items:start}#planning-root .ha-sidebar>.ha-rule{grid-column:1/-1}#planning-root .ha-preview{display:none}#planning-root .ha-weeklyrow{grid-template-columns:1fr 1fr}#planning-root .ha-weeklyrow>div:first-child{grid-column:1/-1}#planning-root .ha-weeklyrow>.ha-check{grid-column:1/-1}}\n@media(max-width:440px){#planning-root .ha-appbar{padding:14px 12px;padding-right:80px}#planning-root .ha-brand{gap:7px;font-size:12px}#planning-root .ha-brand span:last-child{display:none}#planning-root .ha-slash{display:none}#planning-root .ha-main{padding:14px 10px}#planning-root h1{font-size:23px}#planning-root .ha-actions{width:100%}#planning-root .ha-heading .ha-actions .ha-button{width:100%;justify-content:flex-start}#planning-root .ha-sidebar{grid-template-columns:1fr}#planning-root .ha-day{min-height:73px;padding:5px 2px}#planning-root .ha-date{font-size:11px;min-width:20px;line-height:20px}#planning-root .ha-dayevent{display:none}#planning-root .ha-mobile-events{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-top:6px}#planning-root .ha-closed-label{font-size:11px}#planning-root .ha-day.closed .ha-closed-label{font-size:0}#planning-root .ha-day.closed .ha-closed-label:after{content:'Exclu';font-size:11px}#planning-root .ha-legend{gap:8px 12px}#planning-root .ha-footer{gap:5px}#planning-root .ha-field input,#planning-root .ha-field select{font-size:16px}}\n@media(pointer:coarse){#planning-root .ha-iconbutton{width:44px;height:44px}#planning-root .ha-button,#planning-root .ha-textbutton,#planning-root .ha-tabs button{min-height:44px}}\n\n:host{display:block;color-scheme:light}:host([dark]){color-scheme:dark}ha-card{overflow:hidden}#planning-root{border:0;border-radius:var(--ha-card-border-radius,12px);--ha-bg:var(--primary-background-color);--ha-surface:var(--card-background-color);--ha-text:var(--primary-text-color);--ha-muted:var(--secondary-text-color);--ha-border:var(--divider-color);--ha-accent:var(--primary-color);--ha-accent-text:var(--text-primary-color,#fff)}#planning-root .ha-error:empty,#planning-root .ha-feedback:empty{display:none}#planning-root .ha-top-error{margin-bottom:15px}#planning-root .ha-panel button{max-width:100%}#planning-root .ha-weeklyrow{grid-template-columns:1fr auto}#planning-root .ha-note{margin-top:8px}#planning-root .ha-settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}#planning-root .ha-wide{grid-column:1/-1}#planning-root .ha-confirm-delete{margin-top:12px;padding-top:12px;border-top:1px solid var(--ha-border)}#planning-root .ha-list-empty{min-height:70px}#planning-root .ha-button:disabled{pointer-events:none}#planning-root .ha-weeklyrow p{margin-top:5px}@media(max-width:440px){#planning-root .ha-settings{grid-template-columns:1fr}#planning-root .ha-weeklyrow{grid-template-columns:1fr}#planning-root .ha-weeklyrow .ha-actions{justify-content:flex-start}}\n@container planning (max-width:860px){#planning-root .ha-main{padding:18px}#planning-root .ha-workspace{grid-template-columns:minmax(0,1fr) 255px;gap:12px}#planning-root .ha-day{min-height:84px}#planning-root .ha-dayevent{padding:2px;font-size:11px}#planning-root .ha-appbar{padding-left:18px}}\n\n@container planning (max-width:700px){#planning-root .ha-workspace{grid-template-columns:1fr}#planning-root .ha-sidebar{display:grid;grid-template-columns:1fr 1fr;align-items:start}#planning-root .ha-sidebar>.ha-rule{grid-column:1/-1}#planning-root .ha-preview{display:none}#planning-root .ha-weeklyrow{grid-template-columns:1fr 1fr}#planning-root .ha-weeklyrow>div:first-child{grid-column:1/-1}#planning-root .ha-weeklyrow>.ha-check{grid-column:1/-1}}\n\n@container planning (max-width:440px){#planning-root .ha-appbar{padding:14px 12px;padding-right:80px}#planning-root .ha-brand{gap:7px;font-size:12px}#planning-root .ha-brand span:last-child{display:none}#planning-root .ha-slash{display:none}#planning-root .ha-main{padding:14px 10px}#planning-root h1{font-size:23px}#planning-root .ha-actions{width:100%}#planning-root .ha-heading .ha-actions .ha-button{width:100%;justify-content:flex-start}#planning-root .ha-sidebar{grid-template-columns:1fr}#planning-root .ha-day{min-height:73px;padding:5px 2px}#planning-root .ha-date{font-size:11px;min-width:20px;line-height:20px}#planning-root .ha-dayevent{display:none}#planning-root .ha-mobile-events{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;margin-top:6px}#planning-root .ha-closed-label{font-size:11px}#planning-root .ha-day.closed .ha-closed-label{font-size:0}#planning-root .ha-day.closed .ha-closed-label:after{content:'Exclu';font-size:11px}#planning-root .ha-legend{gap:8px 12px}#planning-root .ha-footer{gap:5px}#planning-root .ha-field input,#planning-root .ha-field select{font-size:16px}}\n\n@container planning (max-width:440px){#planning-root .ha-settings{grid-template-columns:1fr}#planning-root .ha-weeklyrow{grid-template-columns:1fr}#planning-root .ha-weeklyrow .ha-actions{justify-content:flex-start}}\n:host{container-type:inline-size;container-name:planning;height:100%;min-width:0}ha-card{display:block;height:100%;overflow:auto}#planning-root{height:100%;min-height:620px}#planning-root .ha-main{height:100%;display:flex;flex-direction:column;min-height:0}#planning-root .ha-setup{margin-bottom:12px}#planning-root #calendar-panel{flex:1;min-height:440px}#planning-root .ha-workspace{height:100%;align-items:stretch}#planning-root .ha-calendar{display:flex;flex-direction:column;min-height:440px}#planning-root .ha-monthgrid{flex:1;grid-template-rows:repeat(var(--planning-week-rows,6),minmax(70px,1fr))}#planning-root .ha-day{min-height:0}#planning-root .ha-footer{margin-top:auto;padding-top:12px}#planning-root .ha-feedback{flex-shrink:0}@container planning (max-width:700px){#planning-root{height:auto;min-height:100%}#planning-root .ha-main{height:auto;min-height:100%}#planning-root #calendar-panel{flex:none}#planning-root .ha-workspace{height:auto}#planning-root .ha-calendar{min-height:520px}}\n#planning-root .ha-time-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:0}#planning-root .ha-device-picker{border:1px solid var(--ha-border);border-radius:10px;padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}#planning-root .ha-device-picker legend{padding:0 5px;font-weight:600}#planning-root .ha-device-picker .ha-check{margin:0;padding:6px;align-items:center;min-width:0}#planning-root .ha-device-picker input{flex-shrink:0}#planning-root .ha-field input[type=color]{width:100%;min-height:40px;padding:4px}#planning-root .ha-weekly-group{padding:14px 0;border-bottom:1px solid var(--ha-border)}#planning-root .ha-weekly-group>.ha-button{margin-top:12px}#planning-root .ha-weeklyrow,#planning-root .ha-launch{border-inline-start:4px solid var(--event-color,#3689e6);padding-inline-start:12px}#planning-root .ha-color-swatch{display:inline-block;width:10px;height:10px;background:var(--event-color);border-radius:50%;margin-inline-end:7px}#planning-root .ha-dayevent.regular,#planning-root .ha-dayevent.exceptional{background:var(--event-color);color:var(--event-text);border-color:var(--event-color)}#planning-root .ha-dot.regular,#planning-root .ha-dot.exceptional{background:var(--event-color,#3689e6)}#planning-root .ha-device-summary{font-size:13px;overflow-wrap:anywhere}@container planning (max-width:440px){#planning-root .ha-device-picker{grid-template-columns:1fr}}\n#planning-root .ha-time-inputs{grid-column:1/-1}#planning-root #calendar-panel{overflow:auto}#planning-root .ha-footer{flex-shrink:0}@container planning (min-width:701px){#planning-root .ha-workspace{grid-template-rows:minmax(0,1fr)}#planning-root .ha-sidebar{min-height:0;overflow-y:auto;scrollbar-width:thin}}";

class PlanningChauffeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('change', e => this._change(e));
    this.shadowRoot.addEventListener('click', e => this._groups(e));
  }
  set hass(value) { this._hass = value; if (!this._rendered) this._render(); }
  setConfig(value) { this._config = { demo: true, ...value, title: value.title === 'Planning de chauffe' ? 'Planning' : value.title, devices: (value.devices || []).map(d => ({...d})), groups: (value.groups || DEFAULT_GROUPS).map(g => ({ name: g.name || '', calendar: g.calendar || '' })) }; this._render(); }
  _emit() { this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: { ...this._config, devices: this._config.devices.map(d => ({ ...d })), groups: this._config.groups.map(g => ({ ...g })) } } })); }
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
    if (el.dataset.device !== undefined) this._config.devices[Number(el.dataset.device)][el.dataset.field] = value;
    else if (el.dataset.group !== undefined) this._config.groups[Number(el.dataset.group)][el.dataset.field] = value;
    else this._config[el.dataset.field] = value;
    if (el.dataset.field === 'calendar' && el.dataset.group === undefined && value) this._config.demo = false;
    this._emit();
    if (el.dataset.field === 'demo' || el.dataset.field === 'calendar') this._render();
  }
  _render() {
    if (!this._config || !this._hass) return;
    this._rendered = true;
    const calendars = Object.values(this._hass.states || {}).filter(s => s.entity_id.startsWith('calendar.'));
    const legacy = !this._config.calendar && !!this._config.closure_calendar;
    const select = (label, field, value, index) => `<label>${label}<select data-field="${field}" ${index === undefined ? '' : `data-group="${index}"`}><option value="">Choisir un calendrier</option>${calendars.map(s => `<option value="${esc(s.entity_id)}" ${value === s.entity_id ? 'selected' : ''}>${esc(s.attributes.friendly_name || s.entity_id)} (${esc(s.entity_id)})</option>`).join('')}</select></label>`;
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color)}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font:inherit}input,select,button{font:inherit;padding:10px;box-sizing:border-box;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:6px}input,select{width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px}fieldset{border:1px solid var(--divider-color);border-radius:8px;margin:15px 0;padding:12px}legend{padding:0 5px}button{min-height:40px}button:disabled{opacity:.5}</style>
      <label>Titre<input data-field="title" value="${esc(this._config.title || 'Planning')}"></label>
      ${select('Calendrier du planning', 'calendar', this._config.calendar)}
      <p>Un seul calendrier contient les programmations et les exclusions. Aucun groupe n’est nécessaire pour commencer.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${this._config.demo ? 'checked' : ''}>Mode local (sans enregistrement Home Assistant)</label>
      <p>Choisir un calendrier active le mode connecté. Le mode local permet de tester sans enregistrer d’événement.</p>
      <details ${this._config.devices.length ? 'open' : ''}><summary>Appareils programmables</summary>
      <p>Configuration initiale : mêmes identifiants que dans le catalogue du blueprint. Ensuite, chaque utilisateur coche les appareils dans ses programmations.</p>
      ${this._config.devices.map((d, i) => `<fieldset><legend>Appareil ${i + 1}</legend><label>Nom affiché<input data-field="name" data-device="${i}" value="${esc(d.name)}"></label><label>Identifiant<input data-field="id" data-device="${i}" pattern="[a-z0-9_]+" value="${esc(d.id)}"></label><button type="button" data-remove-device="${i}">Retirer cet appareil</button></fieldset>`).join('')}
      <button type="button" data-action="add-device">Ajouter un appareil</button></details>
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
  _name(event) { return event.summary || this._groups()[event.groupIndex]?.name || 'Programmation'; }
  _deviceNames(ids) { return (Array.isArray(ids) ? ids : []).map(id => this._config.devices.find(d => d.id === id)?.name || `${id} (non configuré)`).join(', '); }
  _colorStyle(event) { const color = eventColor(event.meta?.color); return `style="--event-color:${color};--event-text:${colorText(color)}"`; }
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
      html += `<button type="button" class="ha-day ${day.slice(0, 7) !== this._month ? 'outside' : ''} ${closed ? 'closed' : ''} ${day === this._selected ? 'selected' : ''}" data-day="${day}" aria-label="${esc(summary)}" aria-pressed="${day === this._selected}"><span class="ha-date">${Number(day.slice(8))}</span>${closed ? '<span class="ha-closed-label">Exclusion</span>' : ''}${events.slice(0, 3).map(e => `<span ${this._colorStyle(e)} class="ha-dayevent ${['closed', 'replaced', 'external'].includes(this._status(e)) ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}">${esc(localMinute(e.start, this._zone).slice(11))} ${esc(this._name(e))}</span>`).join('')}${events.length > 3 ? `<span class="ha-secondary">+${events.length - 3}</span>` : ''}<span class="ha-mobile-events">${events.slice(0, 6).map(e => `<b ${this._colorStyle(e)} class="ha-dot ${['closed','replaced','external'].includes(this._status(e)) ? 'blocked' : e.meta?.kind === 'restart' ? 'exceptional' : 'regular'}"></b>`).join('')}</span></button>`;
    }
    return html + '</div><div class="ha-legend"><span>Couleur choisie par programmation</span><span><b class="ha-dot closure"></b>Exclusion</span><span><b class="ha-dot blocked"></b>Bloqué / remplacé</span></div>';
  }
  _detailsHtml() {
    const events = this._events.filter(e => e.role === 'group' && dayOf(e.start, this._zone) === this._selected).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel" aria-live="polite"><div class="ha-panel-title"><div><span class="ha-eyebrow">Programmations prévues</span><h2>${esc(this._dayLabel(this._selected))}</h2></div></div>${!events.length ? '<p class="ha-empty">Aucune programmation ce jour.</p>' : ''}${events.map(e => `<article class="ha-launch" ${this._colorStyle(e)}><div class="ha-launchhead"><span>${esc(this._name(e))}</span><span class="ha-time">${esc(localMinute(e.start, this._zone).slice(11))}</span></div><span class="ha-badge ${this._status(e) !== 'planned' ? 'cancelled' : e.meta?.kind === 'restart' ? 'exceptional' : ''}">${this._statusText(e)}</span>${Array.isArray(e.meta?.devices) ? `<p class="ha-device-summary">${esc(this._deviceNames(e.meta.devices))}</p>` : ''}${e.meta?.note ? `<p>${esc(e.meta.note)}</p>` : ''}${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier${e.meta.kind === 'weekly' ? ' la série' : ''}</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>${e.meta.kind === 'weekly' ? 'Supprimer la série' : 'Supprimer la programmation'}</button></div>` : ''}</article>`).join('')}<button type="button" class="ha-textbutton" data-action="new-restart" ${!this._hasGroups() || !this._canWrite() ? 'disabled' : ''}>+ Ajouter une programmation</button></section>`;
  }
  _closuresHtml() {
    const closures = this._events.filter(e => e.role === 'closure' && e.end > toInstant(`${viewRange(this._month).start}T00:00`, this._zone)).sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="ha-panel"><div class="ha-panel-title"><h3>Périodes d’exclusion</h3></div>${!closures.length ? '<p class="ha-empty">Aucune exclusion sur la période affichée.</p>' : ''}${closures.map(e => `<article class="ha-closure-item"><h3>${esc(e.summary)}</h3><p>Du ${esc(this._date(e.start))}<br>au ${esc(this._date(e.end))}</p><span class="ha-badge cancelled">Démarrages bloqués</span>${this._editable(e) ? `<div class="ha-rowactions"><button type="button" class="ha-textbutton" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button></div>` : '<p>Géré depuis le calendrier Home Assistant.</p>'}</article>`).join('')}</section>`;
  }
  _weeklyHtml() {
    if (!this._hasGroups()) return '<h2>Horaires habituels</h2><p class="ha-empty">Choisissez un calendrier dans l’éditeur de carte pour ajouter un horaire.</p>';
    return `<div class="ha-weekly-head"><h2>Semaine habituelle</h2><p class="ha-secondary">Ajoutez autant d’horaires que nécessaire. Chaque série possède ses appareils et sa couleur.</p></div>${this._groups().map((g, i) => {
      const series = [...new Map(this._events.filter(e => e.groupIndex === i && e.meta?.kind === 'weekly').map(e => [e.uid || e.meta.id || e.key, e])).values()].sort((a, b) => weekday(dayOf(a.start, this._zone)) - weekday(dayOf(b.start, this._zone)) || localMinute(a.start, this._zone).slice(11).localeCompare(localMinute(b.start, this._zone).slice(11)));
      return `<section class="ha-weekly-group"><h3>${esc(g.name)}</h3>${!series.length ? '<p class="ha-empty">Aucun horaire sur la période affichée.</p>' : ''}${series.map(e => `<article class="ha-weeklyrow" ${this._colorStyle(e)}><div><h3><span class="ha-color-swatch"></span>${esc(this._name(e))}</h3><p class="ha-secondary">${esc(new Intl.DateTimeFormat('fr-BE', { timeZone: this._zone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(e.start)))}</p>${e.meta.devices ? `<p>${esc(this._deviceNames(e.meta.devices))}</p>` : ''}</div><div class="ha-actions"><button type="button" class="ha-button" data-edit="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Modifier la série</button><button type="button" class="ha-textbutton danger" data-delete="${esc(e.key)}" ${!this._canWrite() ? 'disabled' : ''}>Supprimer</button></div></article>`).join('')}<button type="button" class="ha-button" data-weekly="${i}" ${!this._canWrite() || !g.name.trim() ? 'disabled' : ''}>Ajouter un horaire</button></section>`;
    }).join('')}`;
  }
  _timeFields(value = '') {
    const [hour = '', minute = ''] = value.split(':');
    const minutes = ['00','10','20','30','40','50'];
    if (minute && !minutes.includes(minute)) minutes.push(minute);
    const select = (label, name, values, current) => `<label class="ha-field">${label}<select name="${name}" required><option value="">—</option>${values.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}${name === 'minute' && Number(v) % 10 ? ' (valeur existante)' : ''}</option>`).join('')}</select></label>`;
    return `<div class="ha-time-inputs">${select('Heure', 'hour', Array.from({length:24}, (_, i) => String(i).padStart(2, '0')), hour)}${select('Minutes', 'minute', minutes.sort(), minute)}</div>`;
  }
  _seriesOptions(d) {
    const series = [...new Map(this._events.filter(e => e.meta?.kind === 'weekly' && e.meta.id).map(e => [e.meta.id, e])).values()];
    if (d.replace_series && !series.some(e => e.meta.id === d.replace_series)) series.push({meta:{id:d.replace_series}, summary:'Série hors de la période affichée'});
    return `<label class="ha-field ha-wide">Horaire à remplacer cette semaine<select name="replace_series"><option value="">Conserver tous les horaires habituels</option>${series.map(e => `<option value="${esc(e.meta.id)}" ${e.meta.id === d.replace_series ? 'selected' : ''}>${esc(this._name(e))}${e.start ? ` · ${esc(this._date(e.start, {weekday:'short'}))}` : ''}</option>`).join('')}</select></label>`;
  }
  _field(label, name, type, value) { return `<label class="ha-field">${label}<input type="${type}" name="${name}" value="${esc(value)}" required ${this._busy ? 'disabled' : ''}></label>`; }
  _editorHtml() {
    const d = this._draft, editing = !!d.uid;
    const title = this._editor === 'delete' ? 'Confirmer la suppression' : `${editing ? 'Modifier' : 'Ajouter'} ${d.kind === 'closure' ? 'une exclusion' : d.kind === 'weekly' ? 'un horaire habituel' : 'une programmation'}`;
    let html = `<section class="ha-panel ha-editor" aria-label="Formulaire de programmation"><div class="ha-panel-title"><h3>${title}</h3><button type="button" class="ha-iconbutton" data-action="close-editor" aria-label="Fermer" ${this._busy ? 'disabled' : ''}>×</button></div>`;
    if (this._editor === 'review' || this._editor === 'delete') {
      html += `<div class="ha-summary"><strong>${esc(d.summary)}</strong>${this._editor === 'delete' ? (d.kind === 'weekly' ? 'Toute la série hebdomadaire sera supprimée.' : 'Cet événement sera supprimé du calendrier.') : d.kind === 'closure' ? `Du ${esc(this._date(d.start))} au ${esc(this._date(d.end))}. Les activations pendant cette période seront bloquées.` : `${esc(this._date(d.start))}${d.kind === 'weekly' ? ' · toutes les semaines' : d.replace_series ? '<br>Remplace uniquement la série choisie pour cette semaine.' : d.replace ? '<br>Remplace tous les horaires de ce groupe pour cette semaine.' : '<br>Ajoute une programmation ponctuelle.'}`}${d.devices ? `<p>Appareils : ${esc(this._deviceNames(d.devices))}</p>` : ''}</div>${this._editor === 'review' && d.uid && d.kind === 'weekly' ? '<p class="ha-secondary ha-note">Cette modification concerne toute la série hebdomadaire.</p>' : ''}<div class="ha-review-buttons">${this._button(this._busy ? 'Enregistrement…' : this._config.demo ? 'Confirmer en mode local' : 'Confirmer dans Home Assistant', this._editor === 'delete' ? 'confirm-delete' : 'save')}${this._button('Retour', 'back', true)}</div>`;
    } else {
      html += '<form><div class="ha-settings">';
      if (d.kind === 'closure') html += `<div class="ha-wide">${this._field('Libellé', 'summary', 'text', d.summary)}${this._field('Début de la période', 'start', 'datetime-local', d.start ? localMinute(d.start, this._zone) : '')}${this._field('Fin de la période', 'end', 'datetime-local', d.end ? localMinute(d.end, this._zone) : '')}</div>`;
      else {
        html += `<label class="ha-field ha-wide">Libellé (facultatif)<input name="summary" maxlength="120" value="${esc(d.summary)}"></label>`;
        if (this._implicitGroup()) html += `<p class="ha-secondary ha-wide">Calendrier : ${esc(this._groups()[0].name)}</p>`;
        else html += `<label class="ha-field ha-wide">Groupe<select name="group" required ${editing ? 'disabled' : ''}><option value="">Choisir un groupe</option>${this._groups().map((g, i) => `<option value="${i}" ${i === d.groupIndex ? 'selected' : ''} ${!g.name.trim() ? 'disabled' : ''}>${esc(g.name)}</option>`).join('')}</select></label>`;
        if (d.kind === 'weekly') html += `<label class="ha-field ha-wide">Jour<select name="day" required><option value="">Choisir un jour</option>${['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map((name, i) => `<option value="${i}" ${d.start && i === weekday(dayOf(d.start, this._zone)) ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
        else html += `<div class="ha-wide">${this._field('Date', 'date', 'date', d.start ? dayOf(d.start, this._zone) : '')}</div>`;
        html += this._timeFields(d.start ? localMinute(d.start, this._zone).slice(11) : '');
        if (this._config.devices.length) html += `<fieldset class="ha-device-picker ha-wide"><legend>Appareils à démarrer</legend>${this._config.devices.map(device => `<label class="ha-check"><input type="checkbox" name="device" value="${esc(device.id)}" ${d.devices?.includes(device.id) ? 'checked' : ''}>${esc(device.name)}</label>`).join('')}</fieldset>`;
        const unknown = (d.devices || []).filter(id => !this._config.devices.some(device => device.id === id));
        if (unknown.length) html += `<p class="ha-error ha-wide">Appareils retirés de la configuration : ${esc(unknown.join(', '))}. Vérifiez la sélection avant d’enregistrer.</p>`;
        html += `<label class="ha-field">Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label>`;
        if (d.kind === 'restart') html += this._seriesOptions(d) + (d.replace ? '<label class="ha-check ha-wide"><input type="checkbox" name="replace" checked>Ancien remplacement : tous les horaires de ce groupe pour la semaine</label>' : '');
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
    this._draft = event ? { ...event, kind: event.meta.kind, note: event.meta.note || '', color: event.meta.color, devices: event.meta.devices, replace_series: event.meta.replace_series, replace: event.meta.replace === true, event_id: event.meta.id || newEventId() } : { kind, groupIndex: index, calendar: kind === 'closure' ? this._closureCalendar() : index === null ? '' : this._calendar(index), start: '', end: '', summary: '', devices: this._config.devices.length ? [] : undefined, replace: false, event_id: newEventId() };
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
        const time = `${data.get('hour')}:${data.get('minute')}`;
        d.start = d.kind === 'weekly' ? nextWeekly(Number(data.get('day')), time, this._zone) : toInstant(`${data.get('date')}T${time}`, this._zone);
        d.end = new Date(Date.parse(d.start) + 300000).toISOString();
        d.devices = this._config.devices.length || d.devices !== undefined ? data.getAll('device') : undefined;
        d.summary = data.get('summary').trim() || (d.devices?.length ? this._deviceNames(d.devices) : `${d.kind === 'weekly' ? 'Horaire habituel' : 'Programmation'} · ${this._groups()[d.groupIndex].name}`);
        d.color = eventColor(data.get('color'));
        if (d.kind === 'weekly') d.rrule = `FREQ=WEEKLY;BYDAY=${['SU','MO','TU','WE','TH','FR','SA'][Number(data.get('day'))]}`;
        d.replace = data.get('replace') === 'on';
        d.replace_series = data.get('replace_series') || undefined;
        if (d.replace_series) {
          d.replace = false;
          const series = this._events.find(e => e.meta?.kind === 'weekly' && e.meta.id === d.replace_series);
          if (series && !sameGroup(series, d)) throw new Error('Choisissez un horaire habituel du même groupe.');
        }
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

})();
