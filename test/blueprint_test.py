"""Execute the shipped blueprint's templates/control flow with mocked HA services.

This verifies decision paths, not Home Assistant's entire automation schema.
No Home Assistant installation or credentials are used.
"""
import ast
import json
from datetime import datetime, timedelta
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo
import yaml
from jinja2.nativetypes import NativeEnvironment
from jinja2 import StrictUndefined

ZONE = ZoneInfo('Europe/Brussels')
class Loader(yaml.SafeLoader):
    pass
Loader.add_constructor('!input', lambda loader, node: {'__input__': loader.construct_scalar(node)})
BLUEPRINT = yaml.load((Path(__file__).parents[1] / 'blueprints/planning-chauffe.yaml').read_text(encoding='utf-8'), Loader=Loader)

def dt(value):
    if isinstance(value, datetime):
        return value
    value = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    return value if value.tzinfo else value.replace(tzinfo=ZONE)

class StopRun(Exception):
    pass

class Runner:
    def __init__(self, kind='restart', test=True, start='2026-11-23T04:00:00+01:00'):
        self.now = dt(start) + timedelta(seconds=1)
        self.inputs = dict(group_name='Test', heating_calendar='calendar.group', closure_calendar='calendar.closure', target_switches=['switch.one'], test_mode=test)
        self.states = {'calendar.group': 'off', 'calendar.closure': 'off', 'switch.one': 'off'}
        self.events = {'calendar.group': [], 'calendar.closure': []}
        self.calls = []
        self.broken_response = False
        self.fail_service = False
        self.env = NativeEnvironment(undefined=StrictUndefined)
        self.env.filters['from_json'] = self.from_json
        self.env.tests['has_value'] = lambda value: self.states.get(value) not in (None, 'unknown', 'unavailable')
        self.env.tests['is_state'] = lambda entity, value: self.states.get(entity) == value
        self.env.globals.update(now=lambda: self.now, states=lambda entity: self.states.get(entity, 'unknown'), as_datetime=dt, as_local=lambda value: dt(value).astimezone(ZONE), as_timestamp=self.timestamp, timedelta=timedelta)
        self.context = {'trigger': {'platform': 'calendar', 'calendar_event': {'start': start, 'description': json.dumps({'planning_chauffe': 1, 'kind': kind})}}}
        self.events['calendar.group'].append({'start': start, 'end': (dt(start) + timedelta(minutes=5)).isoformat(), 'description': self.context['trigger']['calendar_event']['description']})
    @staticmethod
    def from_json(value, default=None):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return default
    @staticmethod
    def timestamp(value, default=None):
        try:
            return dt(value).timestamp()
        except (TypeError, ValueError):
            if default is not None:
                return default
            raise
    def render(self, value):
        if isinstance(value, dict):
            if '__input__' in value:
                return self.inputs[value['__input__']]
            return {k: self.render(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self.render(v) for v in value]
        if isinstance(value, str) and ('{{' in value or '{%' in value):
            result = self.env.from_string(value).render(**self.context)
            if isinstance(result, str):
                result = result.strip()
                try:
                    return ast.literal_eval(result)
                except (ValueError, SyntaxError):
                    pass
            return result
        return value
    def condition(self, value):
        return bool(self.render(value['value_template'] if isinstance(value, dict) else value))
    def sequence(self, actions):
        for step in actions:
            if 'variables' in step:
                for k, v in step['variables'].items():
                    self.context[k] = self.render(v)
            elif 'condition' in step:
                if not self.condition(step):
                    raise StopRun()
            elif 'choose' in step:
                for option in step['choose']:
                    conditions = option['conditions']
                    if all(self.condition(c) for c in (conditions if isinstance(conditions, list) else [conditions])):
                        self.sequence(option['sequence'])
                        break
            elif 'stop' in step:
                raise StopRun()
            elif 'wait_template' in step:
                self.context['wait'] = {'completed': bool(self.render(step['wait_template']))}
            elif 'action' in step:
                service = step['action']
                data = self.render(step.get('data', {}))
                target = self.render(step.get('target', {}))
                self.calls.append((service, data, target))
                if service == 'calendar.get_events':
                    if self.fail_service:
                        raise StopRun()
                    entity = target['entity_id']
                    rows = [e for e in self.events[entity] if dt(e['start']) < dt(data['end_date_time']) and dt(e['end']) > dt(data['start_date_time'])]
                    self.context[step['response_variable']] = {} if self.broken_response else {entity: {'events': rows}}
                elif service == 'switch.turn_on':
                    for entity in target['entity_id']:
                        self.states[entity] = 'on'
    def run(self):
        for k, v in BLUEPRINT['variables'].items():
            self.context[k] = self.render(v)
        try:
            if all(self.condition(c) for c in BLUEPRINT['conditions']):
                self.sequence(BLUEPRINT['actions'])
        except StopRun:
            pass
        return [call for call in self.calls if call[0] == 'switch.turn_on']
    def closure(self, start, end):
        self.events['calendar.closure'].append({'start': start, 'end': end, 'summary': 'Fermeture'})
    def restart(self, start='2026-11-23T06:00:00+01:00', replace=True):
        self.events['calendar.group'].append({'start': start, 'end': (dt(start) + timedelta(minutes=5)).isoformat(), 'description': json.dumps({'planning_chauffe': 1, 'kind': 'restart', 'replace': replace})})

class BlueprintTests(unittest.TestCase):
    def test_default_is_test_mode(self):
        self.assertIs(BLUEPRINT['blueprint']['input']['test_mode']['default'], True)
    def test_test_mode_never_commands_switches(self):
        r = Runner()
        self.assertEqual(r.run(), [])
        self.assertTrue(any(c[0] == 'persistent_notification.create' for c in r.calls))
    def test_real_mode_valid_event(self):
        self.assertEqual(len(Runner(test=False).run()), 1)
    def test_closure_veto_and_end_boundary(self):
        r = Runner(test=False)
        r.closure('2026-11-09T00:00:00+01:00', '2026-11-24T00:00:00+01:00')
        self.assertEqual(r.run(), [])
        r = Runner(test=False)
        r.closure('2026-11-09T00:00:00+01:00', '2026-11-23T04:00:00+01:00')
        self.assertEqual(len(r.run()), 1)
    def test_all_day_closure(self):
        r = Runner(test=False)
        r.closure('2026-11-23', '2026-11-24')
        self.assertEqual(r.run(), [])
    def test_replacement_and_additive_restart(self):
        r = Runner(kind='weekly', test=False)
        r.restart(replace=True)
        self.assertEqual(r.run(), [])
        r = Runner(kind='weekly', test=False)
        r.restart(replace=False)
        self.assertEqual(len(r.run()), 1)
    def test_exact_same_time_deduplicates_weekly(self):
        r = Runner(kind='weekly', test=False)
        r.restart('2026-11-23T04:00:00+01:00', replace=False)
        self.assertEqual(r.run(), [])
    def test_other_cycle_not_replaced(self):
        r = Runner(kind='weekly', test=False)
        r.restart('2026-11-30T04:00:00+01:00')
        self.assertEqual(len(r.run()), 1)
    def test_unavailable_calendar(self):
        r = Runner(test=False)
        r.states['calendar.closure'] = 'unavailable'
        self.assertEqual(r.run(), [])
    def test_empty_or_failed_service_response(self):
        for attr in ('broken_response', 'fail_service'):
            r = Runner(test=False)
            setattr(r, attr, True)
            self.assertEqual(r.run(), [])
    def test_unavailable_relay_blocks_whole_group(self):
        r = Runner(test=False)
        r.inputs['target_switches'] = ['switch.one', 'switch.two']
        r.states['switch.two'] = 'unavailable'
        self.assertEqual(r.run(), [])
    def test_no_targets_and_no_manual_execution(self):
        r = Runner(test=False)
        r.inputs['target_switches'] = []
        self.assertEqual(r.run(), [])
        r = Runner(test=False)
        del r.context['trigger']
        self.assertEqual(r.run(), [])
    def test_unmanaged_or_malformed_event(self):
        for description in ('{}', '[1]', 'not JSON', '{"planning_chauffe":2,"kind":"restart"}'):
            r = Runner(test=False)
            r.context['trigger']['calendar_event']['description'] = description
            self.assertEqual(r.run(), [])
    def test_no_late_catchup(self):
        r = Runner(test=False)
        r.now += timedelta(minutes=2)
        self.assertEqual(r.run(), [])
    def test_cancelled_or_edited_event_does_not_run_from_stale_trigger(self):
        r = Runner(test=False)
        r.events['calendar.group'] = []
        self.assertEqual(r.run(), [])
        r = Runner(test=False)
        r.events['calendar.group'][0]['description'] = '{"planning_chauffe":1,"kind":"restart","replace":true}'
        self.assertEqual(r.run(), [])
    def test_invalid_closure_dates_fail_closed(self):
        r = Runner(test=False)
        r.events['calendar.closure'] = [{'start': 'bad-date', 'end': 'bad-date'}]
        # Actual HA calendar services validate dates before returning them. Test
        # the expression directly so malformed data cannot authorize a start.
        r.context.update(event_ts=r.timestamp(r.context['trigger']['calendar_event']['start']), closure_calendar='calendar.closure', closure_response={'calendar.closure': {'events': r.events['calendar.closure']}})
        expression = next(step['variables']['closure_active'] for step in BLUEPRINT['actions'] if 'variables' in step and 'closure_active' in step['variables'])
        self.assertIs(r.render(expression), True)
    def test_cycle_uses_event_time_across_saturday_midnight(self):
        r = Runner(kind='weekly', test=False, start='2026-11-28T23:59:30+01:00')
        r.now = dt('2026-11-29T00:00:10+01:00')
        r.restart('2026-11-24T06:00:00+01:00')
        self.assertEqual(r.run(), [])

if __name__ == '__main__':
    unittest.main(verbosity=2)
