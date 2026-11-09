"""Exercise actual ical 14.3.0 (HA Local Calendar 2026.10), using JS card payloads."""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import json
import subprocess
import unittest
from ical.calendar import Calendar
from ical.event import Event
from ical.store import EventStore
from ical.types import Recur

ZONE = ZoneInfo('Europe/Brussels')
ROOT = Path(__file__).parents[1]

class NativeCalendarTests(unittest.TestCase):
    def setUp(self):
        self.calendar = Calendar()
        self.store = EventStore(self.calendar)
        self.store.add(Event(dtstart=datetime(2026,11,9,6), dtend=datetime(2026,11,9,7), summary='Chauffe', rrule=Recur.from_rrule('FREQ=WEEKLY;COUNT=4;BYDAY=MO')))
    def rows(self):
        return list(self.calendar.timeline_tz(ZONE).overlapping(datetime(2026,11,1,tzinfo=ZONE),datetime(2026,12,10,tzinfo=ZONE)))
    def payload(self, row, delete=False, scope='occurrence', date='2026-11-18'):
        raw=dict(uid=row.uid,recurrence_id=row.recurrence_id,rrule='FREQ=WEEKLY;COUNT=4;BYDAY=MO',summary=row.summary,start=row.start.replace(tzinfo=ZONE).isoformat(),end=row.end.replace(tzinfo=ZONE).isoformat(),calendar='calendar.test')
        code="""import {schedulePayload,occurrenceDeletePayload,shiftedOccurrence} from './src/actions-model.js';
const e=JSON.parse(process.argv[1]);const d={...e,...shiftedOccurrence(e,process.argv[4],480,'Europe/Brussels'),event_id:'test',scope:process.argv[3],start_actions:[{target:'heat',op:'on'}],end_actions:[{target:'heat',op:'off'}],has_end:true};
console.log(JSON.stringify(process.argv[2]==='delete'?occurrenceDeletePayload(e,process.argv[3]):schedulePayload(d)));"""
        result=subprocess.run(['node','--input-type=module','-e',code,json.dumps(raw),'delete' if delete else 'move',scope,date],cwd=ROOT,check=True,capture_output=True,text=True)
        return json.loads(result.stdout)
    def apply(self,p):
        if p['type'].endswith('/delete'):
            self.store.delete(p['uid'],recurrence_id=p.get('recurrence_id'))
            return
        event=p['event']
        # HA _parse_event converts timezone-aware JSON to floating local datetimes.
        floating=lambda value: datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(ZONE).replace(tzinfo=None)
        self.store.edit(p['uid'],Event(dtstart=floating(event['dtstart']),dtend=floating(event['dtend']),summary=event['summary'],description=event['description']),recurrence_id=p.get('recurrence_id'))
    def test_move_only_one_occurrence(self):
        before=self.rows();self.apply(self.payload(before[1]));after=self.rows()
        self.assertEqual([r.start.day for r in after],[9,18,23,30])
        self.assertEqual(after[1].recurrence_id,before[1].recurrence_id)
        self.assertEqual([r.start for r in after if r.recurrence_id!=before[1].recurrence_id],[r.start for r in before if r.recurrence_id!=before[1].recurrence_id])
    def test_moved_occurrence_can_be_moved_again_then_deleted(self):
        original=self.rows()[1];self.apply(self.payload(original));moved=self.rows()[1]
        self.apply(self.payload(moved,date='2026-11-19'));moved=self.rows()[1]
        self.assertEqual(moved.start.day,19);self.assertEqual(moved.recurrence_id,original.recurrence_id)
        self.apply(self.payload(moved,delete=True))
        self.assertEqual([r.start.day for r in self.rows()],[9,23,30])
    def test_delete_first_day_preserves_three_other_days(self):
        self.apply(self.payload(self.rows()[0],delete=True))
        self.assertEqual([r.start.day for r in self.rows()],[16,23,30])
    def test_explicit_series_delete_includes_detached_exception(self):
        self.apply(self.payload(self.rows()[1]));self.apply(self.payload(self.rows()[0],delete=True,scope='series'))
        self.assertEqual(self.rows(),[])

if __name__=='__main__':unittest.main()
