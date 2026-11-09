"""Run the actual JavaScript card store through HA-shaped native calendar APIs."""
from datetime import datetime
import json
from pathlib import Path
import subprocess
import unittest
from urllib.parse import urlparse, parse_qs
from zoneinfo import ZoneInfo
from ical.calendar import Calendar
from ical.calendar_stream import IcsCalendarStream
from ical.event import Event
from ical.store import EventStore
from ical.types import Recur

ROOT=Path(__file__).parents[1]
ZONE=ZoneInfo('Europe/Brussels')

class NativeSeriesTests(unittest.TestCase):
    def scenario(self,case='normal'):
        calendar=Calendar()
        store=EventStore(calendar)
        store.add(Event(uid='weekly',dtstart=datetime(2026,11,9,6),dtend=datetime(2026,11,9,6,1),summary='Original',description='Original actions',rrule=Recur.from_rrule('FREQ=WEEKLY;COUNT=4;BYDAY=MO')))
        store.edit('weekly',Event(dtstart=datetime(2026,11,18,6,40),dtend=datetime(2026,11,18,6,41),summary='Moved',description='Personal actions'),recurrence_id='20261116T060000')
        store.delete('weekly',recurrence_id='20261123T060000')
        if case=='far':next(event for event in calendar.events if event.rrule).exdate.append(datetime(2031,11,17,6))
        process=subprocess.Popen(['node','test/series-native-client.mjs',case],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
        writes=0;done=False
        for line in process.stdout:
            request=json.loads(line)
            if request['type']=='done':done=True;break
            try:
                kind=request['type'];result=None
                if kind=='ics':result=IcsCalendarStream.calendar_to_ics(calendar)
                elif kind=='reload':calendar=IcsCalendarStream.calendar_from_ics(IcsCalendarStream.calendar_to_ics(calendar));store=EventStore(calendar)
                elif kind=='api':
                    query=parse_qs(urlparse(request['path']).query);start=datetime.fromisoformat(query['start'][0].replace('Z','+00:00'));end=datetime.fromisoformat(query['end'][0].replace('Z','+00:00'))
                    result=[]
                    for event in calendar.timeline_tz(ZONE).overlapping(start,end):
                        result.append(dict(uid=event.uid,start=event.start.replace(tzinfo=ZONE).isoformat(),end=event.end.replace(tzinfo=ZONE).isoformat(),summary=event.summary,description=event.description or '',rrule=event.rrule.as_rrule_str() if event.rrule else None,recurrence_id=str(event.recurrence_id) if event.recurrence_id else None))
                elif kind=='ws':
                    p=request['payload'];self.assertTrue(p['type'].startswith('calendar/event/'));writes+=1
                    if p['type'].endswith('/delete'):store.delete(p['uid'],recurrence_id=p.get('recurrence_id'))
                    else:
                        e=p['event'];floating=lambda v:datetime.fromisoformat(v.replace('Z','+00:00')).astimezone(ZONE).replace(tzinfo=None)
                        event=Event(dtstart=floating(e['dtstart']),dtend=floating(e['dtend']),summary=e['summary'],description=e.get('description',''),**({'rrule':Recur.from_rrule(e['rrule'])} if e.get('rrule') else {}))
                        if p['type'].endswith('/create'):store.add(event)
                        else:store.edit(p['uid'],event,recurrence_id=p.get('recurrence_id'))
                process.stdin.write(json.dumps({'result':result})+'\n');process.stdin.flush()
            except Exception as error:
                process.stdin.write(json.dumps({'error':{'code':'failed','message':str(error)}})+'\n');process.stdin.flush()
        process.stdin.close();errors=process.stderr.read();process.stdout.close();process.stderr.close();process.wait(timeout=15)
        self.assertEqual(process.returncode,0,errors);self.assertTrue(done,errors)
        if case=='unknown':self.assertEqual(writes,0)
    def test_legacy_ics_exceptions_and_repeated_edits_survive_native_roundtrip(self):self.scenario()
    def test_far_future_tombstone_is_kept_in_the_shared_journal(self):self.scenario('far')
    def test_unknown_deleted_days_are_never_silently_discarded(self):self.scenario('unknown')

if __name__=='__main__':unittest.main()
