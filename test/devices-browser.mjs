import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=process.env.PLANNING_NODE_MODULES ? createRequire(`${process.env.PLANNING_NODE_MODULES.replaceAll('\\','/')}/package.json`) : createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=new URL('../',import.meta.url), bundle=await readFile(new URL('dist/ha-planning-card.js',root),'utf8'), fixture=await readFile(new URL('test/fixtures/hass.js',root),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.PLANNING_BROWSER ? {executablePath:process.env.PLANNING_BROWSER} : {})});
const page=await browser.newPage({viewport:{width:1200,height:1100}}), errors=[];
page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
await page.route('https://planning.test/**',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#111315;--primary-background-color:#111315;--card-background-color:#1d1f21;--secondary-background-color:#22272b;--primary-text-color:#e8edf0;--secondary-text-color:#a6b2bb;--divider-color:#363b40;--primary-color:#32c5eb;--text-primary-color:#002c39}</style><ha-planning-card></ha-planning-card>'}));
const card=page.locator('ha-planning-card'), button=name=>card.getByRole('button',{name,exact:true});
const waitSave=()=>page.waitForFunction(()=>!testPlanning.card._busy && !testPlanning.card._deviceDraft);
async function addDevice(name,type) {
  await button('Ajouter un appareil').click();await card.locator('input[name=name]').fill(name);await card.locator('select[name=type]').selectOption(type);
  if(type!=='script') await card.locator('select[name=switch_entity]').selectOption(type==='frech' ? 'switch.machine_b' : 'switch.machine_a');
  if(type!=='switch') await card.locator('select[name=script_entity]').selectOption(type==='frech' ? 'script.start_machine' : 'script.simple_start');
  if(type==='frech'){await card.locator('select[name=input_entity]').selectOption('binary_sensor.machine_a');await card.locator('input[name=frech_number]').fill('3');}
  await button('Vérifier l’appareil').click();await button('Enregistrer l’appareil').click();await waitSave();
}
try {
  await page.goto('https://planning.test/');await page.addScriptTag({content:bundle});await page.addScriptTag({content:fixture});await page.evaluate(()=>setupPlanningTest(false,false,'managed'));await page.waitForFunction(()=>testPlanning.card._loaded);
  await card.getByRole('tab',{name:'Appareils',exact:true}).click();
  await addDevice('Appareil A','switch');await addDevice('Scénario B','script');await addDevice('Frech C','frech');
  assert.equal(await card.locator('.ha-device-row').count(),3);
  assert.equal(await page.evaluate(()=>Object.keys(testPlanning.automationConfig.use_blueprint.input.machine_catalog).length),3);
  assert.equal(await page.evaluate(()=>testPlanning.apiWrites.length),3);
  assert.equal(await page.evaluate(()=>testPlanning.rows['calendar.test_a'].filter(row=>JSON.parse(row.description).planning_devices===1).length),1);
  const ids=await page.evaluate(()=>testPlanning.card._devices().map(d=>d.id));
  await card.locator('.ha-device-row').filter({hasText:'Appareil A'}).getByRole('button',{name:'Modifier l’appareil'}).click();await card.locator('input[name=name]').fill('Relais renommé');await button('Vérifier l’appareil').click();await button('Enregistrer l’appareil').click();await waitSave();
  assert.deepEqual(await page.evaluate(()=>testPlanning.card._devices().map(d=>d.id)),ids);
  await mkdir(new URL('test-results/',root),{recursive:true});await card.screenshot({path:fileURLToPath(new URL('test-results/devices-management.png',root))});
  await card.getByRole('tab',{name:'Calendrier',exact:true}).click();await button('Ajouter une programmation').click();
  const day=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
  await card.locator('input[name=date]').fill(day);await card.locator('select[name=hour]').selectOption('06');await card.locator('select[name=minute]').selectOption('20');await card.locator(`input[name=device][value="${ids[0]}"]`).check();await card.locator(`input[name=device][value="${ids[2]}"]`).check();
  await button('Vérifier la programmation').click();await button('Confirmer dans Home Assistant').click();await page.waitForFunction(()=>!testPlanning.card._busy && !testPlanning.card._editor);
  const planned=await page.evaluate(()=>testPlanning.rows['calendar.test_a'].find(row=>JSON.parse(row.description).kind==='restart'));
  assert.deepEqual(JSON.parse(planned.description).devices,[ids[0],ids[2]]);
  await button('Semaine').click();assert.equal(await card.locator('.ha-weekgrid').count(),1);assert.ok(await card.locator('.ha-view-event').count());
  await button('Agenda').click();assert.equal(await card.locator('.ha-agenda-day').count(),1);assert.match(await card.locator('.ha-agenda').innerText(),/Relais renommé/);
  await card.screenshot({path:fileURLToPath(new URL('test-results/planning-agenda.png',root))});
  await card.getByRole('tab',{name:'Appareils',exact:true}).click();await card.locator('.ha-device-row').filter({hasText:'Relais renommé'}).getByRole('button',{name:'Modifier l’appareil'}).click();await card.locator('input[name=enabled]').uncheck();await button('Vérifier l’appareil').click();await button('Enregistrer l’appareil').click();await waitSave();
  assert.equal(await page.evaluate(id=>testPlanning.automationConfig.use_blueprint.input.machine_catalog[id].enabled,ids[0]),false);
  await card.getByRole('tab',{name:'Calendrier',exact:true}).click();assert.match(await card.locator('.ha-launch').innerText(),/désactivé ou retiré/);
  await card.getByRole('tab',{name:'Appareils',exact:true}).click();await card.locator('.ha-device-row').filter({hasText:'Relais renommé'}).getByRole('button',{name:'Modifier l’appareil'}).click();await card.locator('input[name=enabled]').check();await button('Vérifier l’appareil').click();await button('Enregistrer l’appareil').click();await waitSave();
  await card.getByRole('tab',{name:'Calendrier',exact:true}).click();assert.match(await card.locator('.ha-launch').innerText(),/Programmation ponctuelle/);
  await card.getByRole('tab',{name:'Appareils',exact:true}).click();await card.locator('.ha-device-row').filter({hasText:'Frech C'}).getByRole('button',{name:'Supprimer',exact:true}).click();await button('Confirmer la suppression').click();await waitSave();
  assert.equal(await page.evaluate(id=>Object.hasOwn(testPlanning.automationConfig.use_blueprint.input.machine_catalog,id),ids[2]),false);
  await card.getByRole('tab',{name:'Calendrier',exact:true}).click();assert.match(await card.locator('.ha-launch').innerText(),/désactivé ou retiré/);
  // Normal users see the shared list, can assign active devices, and cannot edit configuration.
  await page.evaluate(()=>{testPlanning.hass.user.is_admin=false;testPlanning.card.setConfig({...testPlanning.card._config});});await page.waitForFunction(()=>testPlanning.card._loaded);
  await card.getByRole('tab',{name:'Appareils',exact:true}).click();assert.equal(await button('Ajouter un appareil').isDisabled(),true);assert.equal(await card.getByRole('button',{name:'Modifier l’appareil'}).count(),0);assert.equal(await card.locator('.ha-device-row').count(),2);
  // Change appearance through the actual editor and verify the rendered options.
  await page.evaluate(()=>{const editor=document.createElement('ha-planning-card-editor');editor.setConfig(testPlanning.card._config);editor.hass=testPlanning.hass;editor.addEventListener('config-changed',e=>{window.customConfig=e.detail.config;});document.body.append(editor);});
  const editor=page.locator('ha-planning-card-editor');await editor.locator('details').filter({hasText:'Personnalisation'}).evaluate(el=>{el.open=true;});
  await editor.locator('[data-field=default_view]').selectOption('week');await editor.locator('[data-field=density]').selectOption('compact');await editor.locator('[data-field=event_style]').selectOption('outline');await editor.locator('[data-field=show_weekends]').uncheck();await editor.locator('[data-field=time_format]').selectOption('12');
  await page.evaluate(()=>testPlanning.card.setConfig(customConfig));await page.waitForFunction(()=>testPlanning.card._loaded);assert.equal(await card.locator('.ha-weekgrid').count(),1);assert.equal(await card.locator('.ha-weekday').count(),5);assert.equal(await card.locator('#planning-root').getAttribute('data-density'),'compact');await editor.evaluate(el=>el.remove());
  await card.getByRole('tab',{name:'Calendrier',exact:true}).click();await button('Mois').click();assert.equal(await card.locator('.ha-days span').count(),5);
  // Configuration writes use only HA config endpoints; no action/service is invoked by the card.
  assert.equal(await page.evaluate(()=>testPlanning.ws.every(request=>request.type.startsWith('calendar/event/'))),true);
  await page.setViewportSize({width:380,height:1100});await card.getByRole('tab',{name:'Appareils',exact:true}).click();assert.equal(await card.evaluate(el=>el.shadowRoot.querySelector('ha-card').scrollWidth<=el.clientWidth+1),true);
  assert.deepEqual(errors,[]);console.log('Device browser checks passed: three device types, protected persistence, selection in events, rename/order, disable, ordinary-user read-only access, week/agenda, visual customization and mobile.');
} finally {await browser.close();}
