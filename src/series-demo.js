import {dayOf,shiftDay,weekday,localMinute} from './model.js';
import {shiftedOccurrence} from './actions-model.js';

export function expandDemoCalendar(rows,start,end,zone){
  const out=[],from=dayOf(start,zone),to=dayOf(end,zone);
  for(const row of rows){
    if(!row.rrule){if(Date.parse(row.start)<Date.parse(end)&&Date.parse(row.end)>Date.parse(start))out.push({...row});continue;}
    const first=dayOf(row.start,zone),names=['SU','MO','TU','WE','TH','FR','SA'],days=(row.rrule.match(/BYDAY=([^;]+)/)?.[1] || names[weekday(first)]).split(',').map(x=>names.indexOf(x)),count=Number(row.rrule.match(/COUNT=(\d+)/)?.[1] || Infinity),interval=Number(row.rrule.match(/INTERVAL=(\d+)/)?.[1] || 1);let seen=0;
    for(let day=first,index=0;day<to && index<50000;day=shiftDay(day,1),index++){
      const eligible=row.rrule.includes('FREQ=DAILY')?index%interval===0:days.includes(weekday(day))&&Math.floor((index+(weekday(first)+6)%7)/7)%interval===0;
      if(!eligible)continue;if(++seen>count)break;const shifted=shiftedOccurrence(row,day,undefined,zone),rid=localMinute(shifted.start,zone).replace(/[-:]/g,'')+'00';if(day<from||row.deleted?.includes(rid)||row.exceptions?.[rid])continue;out.push({...row,...shifted,recurrence_id:rid});
    }
    for(const [rid,event] of Object.entries(row.exceptions || {}))if(Date.parse(event.start)<Date.parse(end)&&Date.parse(event.end)>Date.parse(start))out.push({...row,...event,rrule:'',recurrence_id:rid});
  }
  return out;
}
