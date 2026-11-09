import {dayOf,toInstant} from './model.js';

// RFC 5545 line folding and TEXT escaping. Import only the selected UID; no
// calendar content is uploaded anywhere or turned into arbitrary HA services.
function textValue(value){return value.replace(/\\([nN,;\\])/g,(_,c)=>c==='n'||c==='N'?'\n':c);}
function property(line){let quoted=false,index=-1;for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;if(line[i]===':'&&!quoted){index=i;break;}}if(index<0)throw new Error('Fichier ICS invalide.');const [name,...parameters]=line.slice(0,index).split(';'),params=Object.fromEntries(parameters.map(p=>{const at=p.indexOf('=');return [p.slice(0,at).toUpperCase(),p.slice(at+1).replace(/^"|"$/g,'')];}));return {name:name.toUpperCase(),params,value:line.slice(index+1)};}
function instant(value,params,zone){
  if(!/^\d{8}T\d{6}Z?$/.test(value))throw new Error('Seules les séries avec une heure sont prises en charge dans cet import.');
  const wall=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}`;
  if(value.endsWith('Z'))return new Date(wall+':'+value.slice(13,15)+'Z').toISOString();
  return new Date(Date.parse(toInstant(wall,params.TZID || zone))+Number(value.slice(13,15))*1000).toISOString();
}
export function importSeriesIcs(source,uid,zone){
  if(typeof source!=='string' || source.length>10_000_000)throw new Error('Fichier ICS invalide ou trop volumineux.');
  const unfolded=source.replace(/^\uFEFF/,'').replace(/\r?\n[ \t]/g,'').trim(),lines=unfolded.split(/\r?\n/);
  if(lines[0]!=='BEGIN:VCALENDAR'||lines.at(-1)!=='END:VCALENDAR'||lines.filter(l=>l==='BEGIN:VCALENDAR').length!==1)throw new Error('Fichier ICS invalide.');
  const events=[];let fields=null,depth=0;
  for(const line of lines){
    if(line==='BEGIN:VEVENT'){if(fields)throw new Error('Fichier ICS invalide.');fields=[];depth=0;continue;}
    if(!fields)continue;
    if(line==='END:VEVENT'){if(depth)throw new Error('Fichier ICS invalide.');events.push(fields);fields=null;continue;}
    if(line.startsWith('BEGIN:')){depth++;continue;}if(line.startsWith('END:')){depth--;continue;}
    if(!depth && line)fields.push(property(line));
  }
  if(fields)throw new Error('Fichier ICS invalide.');
  const matching=events.filter(fields=>textValue(fields.find(p=>p.name==='UID')?.value || '')===uid),masters=matching.filter(fields=>fields.some(p=>p.name==='RRULE')&&!fields.some(p=>p.name==='RECURRENCE-ID'));
  if(masters.length!==1 || matching.some(f=>f.some(p=>p.name==='RDATE'||p.params.RANGE)))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');
  const master=masters[0],get=(fields,name)=>fields.find(p=>p.name===name),payload=fields=>{
    const start=get(fields,'DTSTART'),end=get(fields,'DTEND');if(!start||!end)throw new Error('La série ICS doit préciser son début et sa fin.');
    return {dtstart:instant(start.value,start.params,zone),dtend:instant(end.value,end.params,zone),summary:textValue(get(fields,'SUMMARY')?.value || ''),description:textValue(get(fields,'DESCRIPTION')?.value || ''),...(get(fields,'LOCATION')?{location:textValue(get(fields,'LOCATION').value)}:{})};
  };
  if(get(master,'STATUS')?.value==='CANCELLED' || /(?:BYHOUR|BYMINUTE|BYSECOND)=|FREQ=(?:HOURLY|MINUTELY|SECONDLY)/i.test(get(master,'RRULE').value))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');
  const exceptions={};for(const ex of master.filter(p=>p.name==='EXDATE'))for(const value of ex.value.split(','))exceptions[dayOf(instant(value,ex.params,zone),zone)]={deleted:true};
  for(const fields of matching.filter(f=>f!==master)){const recurrence=get(fields,'RECURRENCE-ID');if(!recurrence||get(fields,'RRULE'))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');const day=dayOf(instant(recurrence.value,recurrence.params,zone),zone);exceptions[day]=get(fields,'STATUS')?.value==='CANCELLED'?{deleted:true}:{event:payload(fields),uid,native:true,recurrence_id:recurrence.value};}
  return {model:{...payload(master),rrule:get(master,'RRULE').value},exceptions};
}
