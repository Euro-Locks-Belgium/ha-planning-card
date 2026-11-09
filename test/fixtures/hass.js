window.setupPlanningTest=({demo=false,admin=true}={})=>{
  const card=window.__planningCard || document.querySelector('ha-planning-card'),calendar='calendar.test';let rows=[],failRead=false,failWrite=false,loseReply=false,loseRead=false;
  const ws=[],apiWrites=[],reads=[];
  let config={id:'test-actions',alias:'Planning test',use_blueprint:{path:'test/planning-actions.yaml',input:{planning_calendar:calendar,test_mode:true,action_catalog:{frech_1:{name:'Frech 1',type:'frech',enabled:true,switch_entity:'switch.frech',script_entity:'script.start_frech',input_entity:'binary_sensor.frech',frech_number:1}}}}};
  const hass={config:{time_zone:'Europe/Brussels'},user:{is_admin:admin},states:{},async callApi(method,path,body){
    reads.push({method,path});if(failRead)throw new Error('Lecture refusée');
    if(path==='config/automation/config/test-actions'){if(!this.user.is_admin)throw new Error('Admin uniquement');if(method==='POST'){config=structuredClone(body);apiWrites.push(structuredClone(body));return {};}return structuredClone(config);}
    if(!path.startsWith('calendars/'))throw new Error('API inattendue '+path);
    const query=new URLSearchParams(path.split('?')[1]);return structuredClone(rows.filter(r=>Date.parse(r.start)<Date.parse(query.get('end')) && Date.parse(r.end)>Date.parse(query.get('start'))));
  },async callWS(p){
    ws.push(structuredClone(p));if(failWrite)throw new Error('Écriture refusée');
    if(!p.type.startsWith('calendar/event/'))throw new Error('Commande inattendue '+p.type);
    if(p.type.endsWith('/delete'))rows=rows.filter(r=>r.uid!==p.uid || (p.recurrence_id && r.recurrence_id!==p.recurrence_id));
    else if(p.type.endsWith('/update')){const matches=rows.filter(r=>r.uid===p.uid && (!p.recurrence_id || r.recurrence_id===p.recurrence_id));if(matches.length!==1)throw new Error('Occurrence introuvable');Object.assign(matches[0],p.event,{start:p.event.dtstart,end:p.event.dtend});}
    else{
      const uid=crypto.randomUUID(),base={...p.event,uid,start:p.event.dtstart,end:p.event.dtend};
      if(!p.event.rrule)rows.push(base);
      else{
        const names=['SU','MO','TU','WE','TH','FR','SA'],days=p.event.rrule.split('BYDAY=')[1].split(','),local=new Date(Date.parse(base.start)+3600000),duration=Date.parse(base.end)-Date.parse(base.start);
        for(let offset=0;offset<84;offset++){const day=new Date(local);day.setUTCDate(day.getUTCDate()+offset);if(!days.includes(names[day.getUTCDay()]))continue;const start=new Date(day.getTime()-3600000).toISOString(),end=new Date(Date.parse(start)+duration).toISOString(),rid=day.toISOString().slice(0,19).replace(/[-:]/g,'');rows.push({...base,start,end,recurrence_id:rid});}
      }
    }
    if(loseReply){loseReply=false;failRead=loseRead;loseRead=false;throw new Error('Réponse perdue');}return null;
  }};
  for(const [entity,name] of Object.entries({'calendar.test':'Planning test','automation.actions':'Exécution planning','switch.heat':'Chauffe atelier','switch.gate':'Barrière secondaire','cover.gate':'Barrière principale','switch.frech':'Frech 1','script.start_frech':'Démarrage Frech','binary_sensor.frech':'Retour Frech','script.simple':'Script simple'}))hass.states[entity]={entity_id:entity,state:entity.startsWith('cover.')?'closed':entity.startsWith('automation.')?'on':'off',attributes:{friendly_name:name,...(entity.startsWith('calendar.')?{supported_features:7}:{}),...(entity.startsWith('automation.')?{id:'test-actions',current:0}:{})}};
  const projection=()=>({uid:'registry',start:'2000-01-01T00:00:00Z',end:'2000-01-02T00:00:00Z',summary:'Configuration',description:JSON.stringify({planning_actions:1,automation:'automation.actions',test_mode:true,actions:Object.entries(config.use_blueprint.input.action_catalog).map(([id,r])=>({id,name:r.name,type:r.type,enabled:r.enabled,entity_id:r.entity_id || r.switch_entity || r.script_entity}))})});
  rows.push(projection());
  window.testPlanning={card,hass,ws,apiWrites,reads,get rows(){return rows;},get config(){return config;},failReads(v){failRead=v;},failWrites(v){failWrite=v;},loseNextReply(){loseReply=true;},loseNextReplyAndRead(){loseReply=true;loseRead=true;},add(row){rows.push(structuredClone(row));}};
  card.setConfig({type:'custom:ha-planning-card',calendar,demo,entities:Object.keys(hass.states).filter(e=>/^(switch|cover|script|binary_sensor)[.]/.test(e))});card.hass=hass;
  if(demo){card._snapshot={ready:true,records:Object.entries(config.use_blueprint.input.action_catalog).map(([id,r])=>({...r,id})),test_mode:true};card._render();}
};
