"""Run the new protected-catalogue blueprint with mocked calendar/actions."""
import json
import unittest
from datetime import timedelta
from pathlib import Path
import yaml
from blueprint_test import Loader
from frech_blueprint_test import FrechRunner

MANAGED = yaml.load((Path(__file__).parents[1] / 'blueprints/planning-devices.yaml').read_text(encoding='utf-8'), Loader=Loader)


class ManagedRunner(FrechRunner):
    def __init__(self, kind='restart', test=False):
        super().__init__(kind=kind, test=test)
        self.blueprint = MANAGED
        self.inputs['machine_catalog'] = {
            'relay_a': dict(type='switch', name='A', enabled=True, switch_entity='switch.machine_1'),
            'script_b': dict(type='script', name='B', enabled=True, script_entity='script.simple_start'),
            'frech_c': dict(type='frech', name='C', enabled=True, switch_entity='switch.machine_3', input_entity='binary_sensor.machine_3', script_entity='script.start_machine', frech_number=3),
        }
        self.states['script.simple_start'] = 'off'
        self.set_meta(planning_chauffe=1, kind=kind, group='', id='series-one', devices=['relay_a','script_b','frech_c'])

    def assert_no_direct_switches(self):
        pass  # The explicit switch type intentionally calls switch.turn_on.

    def run(self):
        super().run()
        return [c for c in self.calls if c[0].startswith(('script.','switch.'))]


class ManagedBlueprintTests(unittest.TestCase):
    def test_three_types_execute_in_catalogue_order_with_exact_parameters(self):
        r = ManagedRunner()
        commands = r.run()
        self.assertEqual([c[0] for c in commands], ['switch.turn_on','script.simple_start','script.start_machine'])
        self.assertEqual(commands[0][2], dict(entity_id='switch.machine_1'))
        self.assertEqual(commands[1][1], {})
        self.assertEqual(commands[2][1], dict(switch_entity='switch.machine_3', input_entity='binary_sensor.machine_3', frech_number=3, wait_time=10))

    def test_default_test_mode_never_commands_devices_or_scripts(self):
        self.assertIs(MANAGED['blueprint']['input']['test_mode']['default'], True)
        r = ManagedRunner(test=True)
        self.assertEqual(r.run(), [])
        self.assertTrue(any(c[0] == 'persistent_notification.create' for c in r.calls))

    def test_unknown_removed_disabled_or_malformed_devices_block_entire_selection(self):
        for change in ('removed','disabled','string_bool','bad_domain','bad_type','bad_number','bad_script'):
            with self.subTest(change=change):
                r = ManagedRunner()
                catalog = r.inputs['machine_catalog']
                if change == 'removed': del catalog['frech_c']
                if change == 'disabled': catalog['frech_c']['enabled'] = False
                if change == 'string_bool': catalog['relay_a']['enabled'] = 'false'
                if change == 'bad_domain': catalog['relay_a']['switch_entity'] = 'automation.invalid'
                if change == 'bad_type': catalog['script_b']['type'] = 'arbitrary_action'
                if change == 'bad_number': catalog['frech_c']['frech_number'] = 22
                if change == 'bad_script': catalog['script_b']['script_entity'] = 'shell_command.invalid'
                self.assertEqual(r.run(), [])

    def test_empty_malformed_duplicate_selection_and_non_object_metadata(self):
        for selection in ([], 'relay_a', None, ['relay_a','relay_a'], [{'id':'relay_a'}]):
            r = ManagedRunner()
            r.set_meta(planning_chauffe=1, kind='restart', devices=selection)
            self.assertEqual(r.run(), [])
        for description in ('[]','null','not-json'):
            r = ManagedRunner()
            r.context['trigger']['calendar_event']['description'] = description
            self.assertEqual(r.run(), [])

    def test_calendar_cannot_override_authoritative_entities_or_scripts(self):
        r = ManagedRunner()
        r.set_meta(planning_chauffe=1,kind='restart',devices=['relay_a'],switch_entity='switch.injection',script_entity='script.injection')
        commands = r.run()
        self.assertEqual(commands, [('switch.turn_on', {}, {'entity_id':'switch.machine_1'})])

    def test_display_registry_record_is_never_executed(self):
        r = ManagedRunner()
        r.set_meta(planning_devices=1,automation='automation.planning',devices=[dict(id='relay_a',switch_entity='switch.injection')])
        self.assertEqual(r.run(), [])

    def test_busy_script_or_unavailable_sensor_blocks_before_first_device(self):
        for entity, state in [('script.simple_start','on'),('binary_sensor.machine_3','unavailable'),('switch.machine_1','unknown')]:
            r = ManagedRunner()
            r.states[entity] = state
            self.assertEqual(r.run(), [])

    def test_cancel_edit_or_new_exclusion_stops_remaining_devices(self):
        for change in ('cancel','edit','closure'):
            r = ManagedRunner()
            def after(r):
                if change == 'cancel': r.events['calendar.group'] = []
                if change == 'edit': r.events['calendar.group'][0]['description'] = '{}'
                if change == 'closure': r.closure(r.now.isoformat(),(r.now+timedelta(hours=1)).isoformat())
            r.after_command = after
            self.assertEqual(len(r.run()), 1)

    def test_failure_closure_and_stale_event_block(self):
        for change in ('closure','failed','broken','stale'):
            r = ManagedRunner()
            if change == 'closure': r.closure('2026-11-23','2026-11-24')
            if change == 'failed': r.fail_service = True
            if change == 'broken': r.broken_response = True
            if change == 'stale': r.events['calendar.group'] = []
            self.assertEqual(r.run(), [])

    def test_targeted_replacement_and_queue_delay(self):
        for series, expected in [('series-one',0),('other-series',3)]:
            r = ManagedRunner(kind='weekly')
            r.restart()
            r.events['calendar.group'][-1]['description'] = json.dumps(dict(planning_chauffe=1,kind='restart',replace_series=series,devices=['relay_a']))
            self.assertEqual(len(r.run()), expected)
        r = ManagedRunner()
        r.queued_delay = timedelta(minutes=30)
        self.assertEqual(len(r.run()),3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
