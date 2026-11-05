export const PlanningDeviceUI = {
  _devices() { return this._deviceCatalog || (this._config.execution_automation ? [] : this._config.devices); },
  _canManageDevices() { return !this._busy && !this._loading && (this._config.demo || (this._hass.user?.is_admin === true && this._deviceStore && this._deviceSnapshot && this._loaded && !this._error)); },
  _devicesHtml() {
    const canManage = this._canManageDevices();
    const connected = this._config.demo || !!this._config.execution_automation;
    const devices = this._devices();
    return `<div class="ha-devices-head"><div><h2>Appareils</h2><p class="ha-secondary">Configurez les appareils, puis choisissez-les dans chaque programmation.</p></div><div class="ha-actions">${this._deviceStore ? this._button('Actualiser la liste','refresh-devices',true) : ''}${this._button('Ajouter un appareil','new-device',false,canManage ? '' : 'disabled')}</div></div>
      ${!connected ? '<p class="ha-setup">Dans l’éditeur de carte, choisissez l’automatisation du blueprint « Planning — appareils configurables » pour enregistrer les appareils.</p>' : ''}
      ${!this._config.demo && this._hass.user?.is_admin !== true ? '<p class="ha-secondary">La configuration technique est réservée aux administrateurs. Vous pouvez utiliser les appareils actifs dans vos programmations.</p>' : ''}
      ${this._deviceSnapshot?.needsPublish ? `<div class="ha-device-notice" role="status">${this._hass.user?.is_admin === true ? 'La liste doit être partagée avec les autres utilisateurs.' : 'La liste n’a pas encore été partagée par un administrateur.'}${canManage ? this._button('Partager la liste','publish-devices',true) : ''}</div>` : ''}
      ${this._deviceDraft ? this._deviceEditorHtml() : ''}
      ${!devices.length ? '<p class="ha-empty">Aucun appareil configuré.</p>' : `<div class="ha-device-list">${devices.map(device => `<article class="ha-device-row"><div><h3>${esc(device.name)} ${device.enabled === false ? '<span class="ha-badge cancelled">Désactivé</span>' : '<span class="ha-badge">Actif</span>'}</h3><p class="ha-secondary">${esc(DEVICE_TYPES[device.type] || 'Appareil existant')}</p>${canManage && device.switch_entity ? `<p>${esc(this._entityLabel(device.switch_entity))}</p>` : ''}${canManage && device.script_entity ? `<p class="ha-secondary">${esc(this._entityLabel(device.script_entity))}</p>` : ''}</div>${canManage ? `<div class="ha-actions"><button type="button" class="ha-button" data-device-edit="${esc(device.id)}">Modifier l’appareil</button><button type="button" class="ha-textbutton danger" data-device-delete="${esc(device.id)}">Supprimer</button></div>` : ''}</article>`).join('')}</div>`}
      ${this._deviceError ? `<div class="ha-error" role="alert">${esc(this._deviceError)}</div>` : ''}`;
  },
  _entityLabel(entity) { return this._hass.states?.[entity]?.attributes?.friendly_name || entity; },
  _entitySelect(label, name, domain, value, required = true) {
    const entities = Object.values(this._hass.states || {}).filter(e => e.entity_id.startsWith(`${domain}.`)).sort((a,b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id,'fr',{numeric:true}));
    if (value && !entities.some(e => e.entity_id === value)) entities.push({entity_id:value,state:'unknown',attributes:{friendly_name:`${value} (indisponible)`}});
    return `<label class="ha-field ha-wide">${label}<select name="${name}" ${required ? 'required' : ''}><option value="">Choisir une entité</option>${entities.map(e => `<option value="${esc(e.entity_id)}" ${e.entity_id === value ? 'selected' : ''}>${esc(e.attributes.friendly_name || e.entity_id)} (${esc(e.entity_id)})</option>`).join('')}</select></label>`;
  },
  _deviceEditorHtml() {
    const d = this._deviceDraft;
    if (this._deviceMode === 'delete') return `<section class="ha-panel ha-device-editor"><h3>Supprimer ${esc(d.name)} ?</h3><p>Ses programmations seront conservées. Les démarrages qui contiennent cet appareil seront bloqués.</p><div class="ha-review-buttons">${this._button('Confirmer la suppression','save-device-delete')}${this._button('Annuler','close-device',true)}</div></section>`;
    if (this._deviceMode === 'review') return `<section class="ha-panel ha-device-editor"><h3>Vérifier l’appareil</h3><p><strong>${esc(d.name)}</strong> · ${esc(DEVICE_TYPES[d.type])} · ${d.enabled ? 'Actif' : 'Désactivé'}</p>${d.switch_entity ? `<p>Relais : ${esc(this._entityLabel(d.switch_entity))}</p>` : ''}${d.script_entity ? `<p>Script : ${esc(this._entityLabel(d.script_entity))}</p>` : ''}${d.type === 'frech' ? `<p>Entrée : ${esc(this._entityLabel(d.input_entity))} · Frech ${d.frech_number}</p>` : ''}<p class="ha-secondary">${this._config.demo ? 'Enregistrement local uniquement.' : 'La configuration de l’automatisation sera enregistrée et rechargée. Aucun appareil ne sera commandé par cet enregistrement.'}</p><div class="ha-review-buttons">${this._button(this._busy ? 'Enregistrement…' : 'Enregistrer l’appareil','save-device')}${this._button('Retour','back-device',true)}</div></section>`;
    return `<section class="ha-panel ha-device-editor"><h3>${this._deviceOriginal ? 'Modifier un appareil' : 'Ajouter un appareil'}</h3><form data-device-form><div class="ha-settings">
      <label class="ha-field ha-wide">Nom affiché<input name="name" value="${esc(d.name)}" required maxlength="120"></label>
      <label class="ha-field ha-wide">Type de démarrage<select name="type" required><option value="">Choisir un type</option>${Object.entries(DEVICE_TYPES).map(([id,name]) => `<option value="${id}" ${id === d.type ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      ${d.type && d.type !== 'script' ? this._entitySelect('Relais à commander','switch_entity','switch',d.switch_entity) : ''}
      ${d.type && d.type !== 'switch' ? this._entitySelect(d.type === 'frech' ? 'Script de démarrage Frech' : 'Script à exécuter','script_entity','script',d.script_entity) : ''}
      ${d.type === 'frech' ? this._entitySelect('Entrée de contrôle','input_entity','binary_sensor',d.input_entity) + `<label class="ha-field">Numéro Frech<input name="frech_number" type="number" min="1" max="21" step="1" value="${esc(d.frech_number ?? '')}" required></label>` : ''}
      <label class="ha-check ha-wide"><input type="checkbox" name="enabled" ${d.enabled ? 'checked' : ''}>Appareil actif dans les programmations</label>
      </div><div class="ha-review-buttons">${this._button('Vérifier l’appareil','review-device')}${this._button('Annuler','close-device',true)}</div></form></section>`;
  },
  _readDeviceForm() {
    const form = this._q('form[data-device-form]');
    if (!form) return this._deviceDraft;
    const data = new FormData(form);
    return { ...this._deviceDraft, name: String(data.get('name') || '').trim(), type: data.get('type') || '', switch_entity: data.get('switch_entity') || '', script_entity: data.get('script_entity') || '', input_entity: data.get('input_entity') || '', frech_number: data.get('frech_number') ? Number(data.get('frech_number')) : undefined, enabled: data.get('enabled') === 'on' };
  },
  _openDevice(device, remove = false) {
    if (!this._canManageDevices()) return;
    this._editor = null; this._deviceError = ''; this._deviceOriginal = device ? {...device} : null;
    this._deviceEditSnapshot = this._deviceSnapshot;
    this._deviceDraft = device ? {...device,enabled:device.enabled !== false} : {id:`device_${newEventId().replaceAll('-','_')}`,name:'',type:'',enabled:true};
    this._deviceMode = remove ? 'delete' : 'form'; this._view = 'devices'; this._render();
  },
  _reviewDevice() {
    if (!this._canManageDevices() || this._deviceMode !== 'form') return;
    const form = this._q('form[data-device-form]');
    if (!form?.reportValidity()) return;
    this._deviceDraft = this._readDeviceForm();
    this._deviceError = validateDevice(this._deviceDraft);
    if (!this._deviceError) this._deviceMode = 'review';
    this._render();
  },
  async _saveDevice(remove = false) {
    if (!this._canManageDevices()) return;
    this._busy = true; this._deviceError = ''; this._render();
    try {
      const d = this._deviceDraft;
      if (!d || (remove ? this._deviceMode !== 'delete' : this._deviceMode !== 'review')) throw new Error('Vérifiez l’appareil avant d’enregistrer.');
      let devices = remove ? this._devices().filter(device => device.id !== d.id) : this._devices().map(device => device.id === d.id ? {...d,...deviceRecord(d)} : device);
      if (!remove && !devices.some(device => device.id === d.id)) devices.push({...d,...deviceRecord(d)});
      if (this._config.demo) this._deviceCatalog = devices;
      else {
        this._deviceSnapshot = await this._deviceStore.save(this._deviceEditSnapshot, devices);
        this._deviceCatalog = this._deviceSnapshot.devices;
      }
      this._deviceDraft = null; this._message = remove ? 'Appareil supprimé du catalogue.' : 'Appareil enregistré. Vous pouvez le choisir dans vos programmations.';
      if (this._deviceSnapshot?.needsPublish) this._message += ' La configuration est enregistrée ; utilisez « Partager la liste » pour actualiser les autres utilisateurs.';
    } catch (error) { this._deviceError = this._errorText(error); }
    finally { this._busy = false; this._render(); }
  },
  async _publishDevices() {
    if (!this._canManageDevices()) return;
    this._busy = true; this._deviceError = ''; this._render();
    try {
      const fresh = await this._deviceStore.load();
      await this._deviceStore.publish(fresh.devices);
      this._deviceSnapshot = {...fresh,needsPublish:false}; this._deviceCatalog = fresh.devices; this._message = 'Liste des appareils partagée.';
    } catch (error) { this._deviceError = this._errorText(error); }
    finally { this._busy = false; this._render(); }
  },
  _deviceClick(button) {
    if (button.dataset.deviceEdit) { const device = this._devices().find(d => d.id === button.dataset.deviceEdit); if (device) this._openDevice(device); return true; }
    if (button.dataset.deviceDelete) { const device = this._devices().find(d => d.id === button.dataset.deviceDelete); if (device) this._openDevice(device,true); return true; }
    switch (button.dataset.action) {
      case 'new-device': this._openDevice(); return true;
      case 'review-device': this._reviewDevice(); return true;
      case 'save-device': void this._saveDevice(); return true;
      case 'save-device-delete': void this._saveDevice(true); return true;
      case 'publish-devices': void this._publishDevices(); return true;
      case 'open-devices': this._editor=null; this._view='devices'; this._render(); return true;
      case 'refresh-devices': this._deviceDraft=null; this._deviceError=''; void this._load(); return true;
      case 'back-device': this._deviceMode='form'; this._deviceError=''; this._render(); return true;
      case 'close-device': this._deviceDraft=null; this._deviceError=''; this._render(); return true;
      default: return false;
    }
  },
};
