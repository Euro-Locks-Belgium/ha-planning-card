import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
const zone = 'Europe/Brussels';
const now = Date.parse('2026-11-05T10:00:00Z');
const base = (kind = 'restart') => ({ kind, calendar: 'calendar.groupe', summary: 'Reprise', start: '2026-11-23T01:00:00.000Z', end: '2026-11-23T01:05:00.000Z', replace: true });
const event = (kind, start, end, extra = {}) => M.normalizeEvent({ uid: kind, summary: kind, start, end, description: JSON.stringify({ planning_chauffe: 1, kind, ...extra }) }, kind === 'closure' ? 'calendar.fermetures' : 'calendar.groupe', kind === 'closure' ? 'closure' : 'group', 0, zone);
test('identifiant unique de reprise, sans secret', () => {
  assert.notEqual(M.newEventId(), M.newEventId());
});
test('heure du site, indépendamment du fuseau du navigateur', () => {
  assert.equal(M.toInstant('2026-11-23T06:00', zone), '2026-11-23T05:00:00.000Z');
  assert.equal(M.toInstant('2026-07-23T06:00', zone), '2026-07-23T04:00:00.000Z');
  assert.equal(M.localMinute('2026-07-23T04:00:00Z', zone), '2026-07-23T06:00');
});
test('heures ambiguës et inexistantes refusées', () => {
  assert.throws(() => M.toInstant('2026-03-29T02:30', zone), /n’existe/);
  assert.throws(() => M.toInstant('2026-10-25T02:30', zone), /ambiguë/);
  assert.throws(() => M.toInstant('2026-02-30T06:00', zone));
});
test('fermeture [début, fin), y compris traversée de minuit', () => {
  const c = event('closure', '2026-11-09T00:00:00+01:00', '2026-11-23T00:00:00+01:00');
  assert.equal(M.isClosed([c], '2026-11-08T23:00:00Z'), true);
  assert.equal(M.isClosed([c], '2026-11-22T22:59:59Z'), true);
  assert.equal(M.isClosed([c], '2026-11-22T23:00:00Z'), false);
});
test('reprise dans une fermeture refusée ; horaire récurrent reste visible mais bloqué', () => {
  const c = event('closure', '2026-11-09T00:00:00+01:00', '2026-11-23T00:00:00+01:00');
  const d = { ...base(), start: '2026-11-15T17:00:00.000Z', end: '2026-11-15T17:05:00.000Z' };
  assert.match(M.validateDraft(d, [c], zone, now), /exclusion/);
  const w = event('weekly', d.start, d.end);
  assert.equal(M.eventStatus(w, [w, c], zone), 'closed');
});
test('cycle dimanche-samedi et remplacement limité au groupe et cycle', () => {
  const w = event('weekly', '2026-11-22T17:00:00Z', '2026-11-22T17:05:00Z');
  const r = event('restart', '2026-11-23T03:00:00Z', '2026-11-23T03:05:00Z', { replace: true });
  assert.equal(M.eventStatus(w, [w, r], zone), 'replaced');
  assert.equal(M.eventStatus(w, [w, { ...r, calendar: 'calendar.autre' }], zone), 'planned');
  assert.equal(M.eventStatus(w, [w, { ...r, start: '2026-11-30T03:00:00Z' }], zone), 'planned');
  assert.equal(M.cycleDay('2026-12-31'), '2026-12-27');
});
test('reprise additive et doublon exact', () => {
  const w = event('weekly', '2026-11-22T17:00:00Z', '2026-11-22T17:05:00Z');
  const r = event('restart', '2026-11-23T03:00:00Z', '2026-11-23T03:05:00Z', { replace: false });
  assert.equal(M.eventStatus(w, [w, r], zone), 'planned');
  assert.equal(M.eventStatus(w, [w, { ...r, start: w.start }], zone), 'replaced');
});
test('délai minimum, doublons, modifications du même uid', () => {
  assert.match(M.validateDraft({ ...base(), start: '2026-11-05T10:19:00Z', end: '2026-11-05T10:24:00Z' }, [], zone, now), /20 minutes/);
  const r = event('restart', base().start, base().end);
  assert.match(M.validateDraft(base(), [r], zone, now), /déjà/);
  assert.equal(M.validateDraft({ ...base(), uid: 'restart' }, [r], zone, now), '');
});
test('un seul horaire hebdomadaire par groupe', () => {
  const w = event('weekly', base().start, base().end);
  assert.match(M.validateDraft(base('weekly'), [w], zone, now), /déjà/);
  assert.equal(M.validateDraft({ ...base('weekly'), uid: 'weekly' }, [w], zone, now), '');
});
test('configuration exige des calendriers distincts ; mode démo sans calendrier', () => {
  assert.equal(M.validateConfig({}).demo, true);
  assert.deepEqual(M.validateConfig({ demo: false }).groups, []);
  assert.throws(() => M.validateConfig({ demo: false, closure_calendar: 'calendar.x', groups: [{ name: 'A', calendar: 'calendar.x' }] }), /distincts/);
  assert.equal(M.validateConfig({ demo: false, closure_calendar: 'calendar.x', groups: [{ name: 'A', calendar: 'calendar.y' }] }).groups.length, 1);
});
test('messages API : dtstart/dtend, uid, métadonnées ; aucune commande de relais', () => {
  const payload = M.calendarPayload({ ...base(), event_id: 'retry-key' });
  assert.equal(payload.type, 'calendar/event/create');
  assert.equal(payload.event.dtstart, base().start);
  assert.equal(JSON.parse(payload.event.description).id, 'retry-key');
  assert.equal(M.calendarPayload({ ...base(), uid: 'x' }).type, 'calendar/event/update');
  assert.deepEqual(M.deletionPayload({ calendar: 'calendar.a', uid: 'x' }), { type: 'calendar/event/delete', entity_id: 'calendar.a', uid: 'x' });
});
test('JSON invalide, version inconnue et balises externes non exécutées', () => {
  assert.equal(M.metadata('not json'), null);
  assert.equal(M.metadata('[1]'), null);
  assert.equal(M.metadata('{"planning_chauffe":2,"kind":"restart"}'), null);
  const e = M.normalizeEvent({ uid: 'e', summary: 'externe', start: base().start, end: base().end, description: '{}' }, 'calendar.groupe', 'group', 0, zone);
  assert.equal(M.eventStatus(e, [e], zone), 'external');
  assert.equal(M.esc('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test('toute fermeture, même externe, bloque ; rôles incohérents ignorés', () => {
  const c = M.normalizeEvent({ uid: 'c', start: '2026-11-23', end: '2026-11-24', summary: 'Fermé' }, 'calendar.fermetures', 'closure', null, zone);
  assert.equal(M.isClosed([c], base().start), true);
  const mismatched = M.normalizeEvent({ ...c, description: JSON.stringify({ planning_chauffe: 1, kind: 'weekly' }) }, 'calendar.fermetures', 'closure', null, zone);
  assert.equal(mismatched.meta, null);
});
test('prochain horaire respecte le délai et la récurrence locale', () => {
  assert.equal(M.nextWeekly(4, '11:10', zone, now), '2026-11-12T10:10:00.000Z');
  assert.equal(M.nextWeekly(4, '11:30', zone, now), '2026-11-05T10:30:00.000Z');
});
test('grille inclut les cycles voisins pour évaluer les remplacements', () => {
  assert.deepEqual(M.viewRange('2026-11'), { start: '2026-10-26', end: '2026-12-07', count: 42, queryStart: '2026-10-19', queryEnd: '2026-12-14' });
});
test('état initial entièrement vide, sans groupes ou événements préremplis', () => {
  const config = M.validateConfig({});
  assert.deepEqual(config.groups, []);
  assert.equal(config.title, 'Planning');
  const state = M.emptyLocalState(zone, now);
  assert.deepEqual(state.events, []);
  assert.equal(state.selected, '2026-11-05');
  assert.equal(M.validateConfig({ title: 'Planning de chauffe' }).title, 'Planning');
});
