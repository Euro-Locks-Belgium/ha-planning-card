window.setupPlanningTest = (demo = true, empty = false, mode = 'legacy') => {
  const card = document.querySelector('ha-planning-card');
  const calendars = ['calendar.test_fermetures', 'calendar.test_a', 'calendar.test_b', 'calendar.test_c'];
  const rows = Object.fromEntries(calendars.map(c => [c, []]));
  const ws = [], reads = [];
  let failRead = false, failWrite = false, loseReply = false;
  const hass = {
    config: { time_zone: 'Europe/Brussels' }, themes: { darkMode: true },
    user: { is_admin: false },
    states: Object.fromEntries(calendars.map(entity_id => [entity_id, { entity_id, state: 'off', attributes: { supported_features: 7, friendly_name: entity_id } }])),
    async callApi(method, path) {
      reads.push({ method, path });
      if (failRead) throw new Error('Lecture refusée');
      if (method !== 'GET' || !path.startsWith('calendars/')) throw new Error('Unexpected API request');
      const [calendar, params] = path.slice(10).split('?');
      const query = new URLSearchParams(params), start = Date.parse(query.get('start')), end = Date.parse(query.get('end'));
      return rows[calendar].filter(e => Date.parse(e.start) < end && Date.parse(e.end) > start).map(e => ({ ...e }));
    },
    async callWS(request) {
      ws.push(JSON.parse(JSON.stringify(request)));
      if (failWrite) throw new Error('Permission de modification refusée');
      if (!request.type.startsWith('calendar/event/')) throw new Error('Unexpected command');
      const list = rows[request.entity_id];
      if (request.type.endsWith('/delete')) rows[request.entity_id] = list.filter(e => e.uid !== request.uid);
      else {
        const saved = { ...request.event, uid: request.uid || crypto.randomUUID(), start: request.event.dtstart, end: request.event.dtend };
        const existing = list.findIndex(e => e.uid === request.uid);
        if (existing < 0) list.push(saved); else list[existing] = saved;
      }
      if (loseReply) { loseReply = false; throw new Error('Connexion perdue après enregistrement'); }
      return null;
    },
  };
  window.testPlanning = { card, hass, rows, ws, reads, failReads(value) { failRead = value; }, failWrites(value) { failWrite = value; }, loseNextReply() { loseReply = true; } };
  card.setConfig(empty ? { type: 'custom:ha-planning-card', demo, groups: [] } : mode !== 'legacy' ? { type: 'custom:ha-planning-card', demo, calendar: calendars[1], groups: mode === 'single' ? [] : [{ name: 'Groupe A' }, { name: 'Groupe B' }] } : { type: 'custom:ha-planning-card', demo, closure_calendar: calendars[0], groups: [{ name: 'Groupe A', calendar: calendars[1] }, { name: 'Groupe B', calendar: calendars[2] }, { name: 'Groupe C', calendar: calendars[3] }] });
  card.hass = hass;
};
