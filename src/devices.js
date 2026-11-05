export const DEVICE_REGISTRY_START = '2000-01-01T00:00:00.000Z';
export const DEVICE_REGISTRY_END = '2000-01-02T00:00:00.000Z';
export const DEVICE_TYPES = { switch: 'Interrupteur / relais', script: 'Script Home Assistant', frech: 'Frech avec contrôle d’entrée' };
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function validateDevice(device) {
  if (!/^[a-z0-9_]+$/.test(device.id || '')) return 'Identifiant d’appareil invalide.';
  if (typeof device.name !== 'string' || !device.name.trim() || device.name.length > 120) return 'Donnez un nom à l’appareil (120 caractères maximum).';
  if (!Object.hasOwn(DEVICE_TYPES, device.type)) return 'Choisissez le type de démarrage.';
  if (typeof device.enabled !== 'boolean') return 'État d’activation invalide.';
  if (device.type !== 'script' && !/^switch\.[a-z0-9_]+$/.test(device.switch_entity || '')) return 'Choisissez un relais Home Assistant.';
  if (device.type !== 'switch' && !/^script\.[a-z0-9_]+$/.test(device.script_entity || '')) return 'Choisissez un script Home Assistant.';
  if (device.type === 'frech' && (!/^binary_sensor\.[a-z0-9_]+$/.test(device.input_entity || '') || !Number.isInteger(device.frech_number) || device.frech_number < 1 || device.frech_number > 21)) return 'Choisissez l’entrée de contrôle et un numéro Frech entre 1 et 21.';
  return '';
}
export function deviceRecord(device) {
  const record = { name: device.name.trim(), type: device.type, enabled: device.enabled };
  if (device.type !== 'script') record.switch_entity = device.switch_entity;
  if (device.type !== 'switch') record.script_entity = device.script_entity;
  if (device.type === 'frech') { record.input_entity = device.input_entity; record.frech_number = device.frech_number; }
  return record;
}
export function devicesFromAutomation(config, calendar) {
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
export function publicDevices(devices) { return devices.map(d => ({ id: d.id, name: d.name, enabled: d.enabled, type: d.type })); }
export function registryMetadata(row, automation) {
  try {
    const meta = JSON.parse(row.description || 'null');
    if (meta?.planning_devices !== 1 || meta.automation !== automation || !Array.isArray(meta.devices)) return null;
    if (meta.devices.some(d => !d || !/^[a-z0-9_]+$/.test(d.id || '') || typeof d.name !== 'string' || !d.name.trim() || typeof d.enabled !== 'boolean') || new Set(meta.devices.map(d => d.id)).size !== meta.devices.length) return null;
    return {planning_devices:1,automation,devices:publicDevices(meta.devices)};
  } catch { return null; }
}
export function deviceRegistryPayload(calendar, automation, devices, uid) {
  return { type: `calendar/event/${uid ? 'update' : 'create'}`, entity_id: calendar, ...(uid ? { uid } : {}), event: {
    dtstart: DEVICE_REGISTRY_START, dtend: DEVICE_REGISTRY_END, summary: 'Planning — liste des appareils',
    description: JSON.stringify({ planning_devices: 1, automation, devices: publicDevices(devices) }),
  } };
}

// The automation configuration is the authoritative catalogue. HA restricts its
// GET/POST endpoints to administrators. The calendar stores labels only, so
// ordinary users can pick devices without access to technical configuration.
export class PlanningDeviceStore {
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
