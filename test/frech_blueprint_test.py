"""Exercise the actual Frech blueprint with calendar and script services mocked."""
import json
import unittest
from datetime import timedelta
from blueprint_test import Runner, StopRun, FRECH_BLUEPRINT


class FrechRunner(Runner):
    def __init__(self, kind='restart', test=False):
        super().__init__(kind=kind, shared=True, test=test)
        self.blueprint = FRECH_BLUEPRINT
        self.inputs.update(startup_script='script.start_machine', wait_time=10, interval_seconds=60,
                           machine_catalog={f'frech_{n}': dict(switch_entity=f'switch.machine_{n}', input_entity=f'binary_sensor.machine_{n}', frech_number=n) for n in (1, 3, 20)})
        self.states.update({'script.start_machine': 'off', **{f'{domain}.machine_{n}': 'off' for domain in ('switch', 'binary_sensor') for n in (1, 3, 20)}})
        self.set_meta(kind=kind, planning_chauffe=1, group='', id='series-one', devices=['frech_1', 'frech_3'])
        self.queued_delay = timedelta()

    def set_meta(self, **meta):
        description = json.dumps(meta)
        self.context['trigger']['calendar_event']['description'] = description
        self.events['calendar.group'][0]['description'] = description

    def run(self):
        for k, v in self.blueprint['variables'].items():
            self.context[k] = self.render(v)
        try:
            if all(self.condition(c) for c in self.blueprint['conditions']):
                # HA evaluates automation conditions before joining its queue.
                self.now += self.queued_delay
                self.sequence(self.blueprint['actions'])
        except StopRun:
            pass
        self.assert_no_direct_switches()
        return [c for c in self.calls if c[0].startswith('script.')]

    def assert_no_direct_switches(self):
        assert not any(c[0].startswith('switch.') or c[0].startswith('input_boolean.') for c in self.calls)


class FrechBlueprintTests(unittest.TestCase):
    def test_sequential_selected_machines_and_existing_script_parameters(self):
        r = FrechRunner()
        before = r.now
        calls = r.run()
        self.assertEqual([c[1]['frech_number'] for c in calls], [1, 3])
        self.assertEqual(calls[0], ('script.start_machine', dict(switch_entity='switch.machine_1', input_entity='binary_sensor.machine_1', frech_number=1, wait_time=10), {}))
        self.assertEqual(r.now - before, timedelta(seconds=80))  # 2 blocking calls + one pause
        self.assertEqual(FRECH_BLUEPRINT['mode'], 'queued')

    def test_test_mode_never_calls_start_script(self):
        self.assertIs(FRECH_BLUEPRINT['blueprint']['input']['test_mode']['default'], True)
        r = FrechRunner(test=True)
        self.assertEqual(r.run(), [])
        self.assertIn('frech_1, frech_3', next(c[1]['message'] for c in r.calls if c[0] == 'persistent_notification.create'))

    def test_empty_unknown_duplicate_and_malformed_selections(self):
        for devices in ([], ['unknown'], ['frech_1', 'unknown'], ['frech_1', 'frech_1'], 'frech_1', None):
            with self.subTest(devices=devices):
                r = FrechRunner()
                r.set_meta(planning_chauffe=1, kind='restart', devices=devices)
                self.assertEqual(r.run(), [])

    def test_legacy_events_have_no_implicit_selection(self):
        r = FrechRunner()
        r.set_meta(planning_chauffe=1, kind='restart')
        self.assertEqual(r.run(), [])

    def test_catalogue_is_only_source_of_entities(self):
        r = FrechRunner()
        r.set_meta(planning_chauffe=1, kind='restart', devices=['frech_20'], switch_entity='switch.injection', startup_script='script.injection')
        self.assertEqual(r.run()[0][1]['switch_entity'], 'switch.machine_20')
        r = FrechRunner()
        r.inputs['machine_catalog']['frech_1']['input_entity'] = 'switch.invalid'
        self.assertEqual(r.run(), [])

    def test_unavailable_sensor_switch_or_busy_script_blocks_before_first_machine(self):
        for entity, value in [('binary_sensor.machine_3', 'unavailable'), ('switch.machine_1', 'unknown'), ('script.start_machine', 'on')]:
            r = FrechRunner()
            r.states[entity] = value
            self.assertEqual(r.run(), [])

    def test_closure_cancelled_edited_and_failed_calendar(self):
        for failure in ('closure', 'cancelled', 'edited', 'fail_service', 'broken_response'):
            r = FrechRunner()
            if failure == 'closure':
                r.closure('2026-11-23', '2026-11-24')
            elif failure == 'cancelled':
                r.events['calendar.group'] = []
            elif failure == 'edited':
                r.events['calendar.group'][0]['description'] = '{}'
            else:
                setattr(r, failure, True)
            self.assertEqual(r.run(), [])

    def test_changes_between_machines_stop_remaining_sequence(self):
        for change in ('cancel', 'edit', 'closure', 'sensor', 'calendar_error'):
            r = FrechRunner()
            def after_script(r):
                if change == 'cancel':
                    r.events['calendar.group'] = []
                elif change == 'edit':
                    r.events['calendar.group'][0]['description'] = '{}'
                elif change == 'closure':
                    r.closure(r.now.isoformat(), (r.now + timedelta(hours=1)).isoformat())
                elif change == 'sensor':
                    r.states['binary_sensor.machine_3'] = 'unavailable'
                else:
                    r.fail_service = True
            r.after_script = after_script
            self.assertEqual(len(r.run()), 1, change)

    def test_targeted_replacement_does_not_cancel_other_weekly_series(self):
        for target, expected in [('series-one', 0), ('series-other', 2)]:
            r = FrechRunner(kind='weekly')
            r.restart()
            r.events['calendar.group'][-1]['description'] = json.dumps(dict(planning_chauffe=1, kind='restart', group='', replace_series=target, devices=['frech_20']))
            self.assertEqual(len(r.run()), expected)

    def test_same_time_with_other_devices_keeps_weekly_series(self):
        r = FrechRunner(kind='weekly')
        r.restart('2026-11-23T04:00:00+01:00', replace=False)
        r.events['calendar.group'][-1]['description'] = json.dumps(dict(planning_chauffe=1, kind='restart', group='', devices=['frech_20']))
        self.assertEqual(len(r.run()), 2)

    def test_legitimate_queue_delay_is_processed_but_late_trigger_is_not(self):
        r = FrechRunner()
        r.queued_delay = timedelta(minutes=30)
        self.assertEqual(len(r.run()), 2)
        r = FrechRunner()
        r.now += timedelta(minutes=2)
        self.assertEqual(r.run(), [])

    def test_exclusion_and_manual_trigger_never_start_machines(self):
        self.assertEqual(FrechRunner(kind='closure').run(), [])
        r = FrechRunner()
        del r.context['trigger']
        self.assertEqual(r.run(), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
