import copy
import json
from pathlib import Path
import unittest
import yaml
from blueprint_test import Runner, Loader, dt
from datetime import timedelta

BLUEPRINT=yaml.load((Path(__file__).parents[1]/'blueprints/planning-actions.yaml').read_text(encoding='utf-8'),Loader=Loader)
CATALOG={
    'heat':dict(type='switch',name='Chauffe',entity_id='switch.heat',enabled=True),
    'gate':dict(type='cover',name='Barrière',entity_id='cover.gate',enabled=True),
    'frech':dict(type='frech',name='Frech 1',switch_entity='switch.f1',input_entity='binary_sensor.f1',script_entity='script.start',frech_number=1,enabled=True),
    'scene':dict(type='scene',entity_id='scene.day',enabled=True),
    'light':dict(type='light',entity_id='light.shop',enabled=True),
    'script':dict(type='script',entity_id='script.simple',enabled=True),
}

class ActionRunner(Runner):
    def __init__(self,phase='start',test=False,actions=None,end_actions=None):
        super().__init__(test=test)
        self.blueprint=BLUEPRINT
        self.inputs=dict(planning_calendar='calendar.group',action_catalog=copy.deepcopy(CATALOG),test_mode=test)
        start='2026-11-23T06:00:00+01:00';end='2026-11-23T08:00:00+01:00'
        self.now=dt(start if phase=='start' else end)+timedelta(seconds=1)
        meta=dict(planning=2,kind='schedule',id='test',has_end=end_actions is not None,start_actions=actions if actions is not None else [dict(target='heat',op='on')],end_actions=end_actions or [])
        self.context={'trigger':dict(platform='calendar',id=phase,calendar_event=dict(start=start,end=end,description=json.dumps(meta)))}
        self.events['calendar.group']=[copy.deepcopy(self.context['trigger']['calendar_event'])]
        self.states.update({'switch.heat':'off','cover.gate':'closed','switch.f1':'off','binary_sensor.f1':'on','script.start':'off','scene.day':'scening','light.shop':'off','script.simple':'off'})
    def commands(self):
        self.run()
        return [(s,d,t) for s,d,t in self.calls if s!='calendar.get_events' and s!='persistent_notification.create']
    def change_meta(self,fn):
        event=self.context['trigger']['calendar_event'];meta=json.loads(event['description']);fn(meta);event['description']=json.dumps(meta);self.events['calendar.group'][0]['description']=event['description']

class ActionBlueprintTests(unittest.TestCase):
    def test_default_test_mode_and_independent_end_trigger(self):
        self.assertIs(BLUEPRINT['blueprint']['input']['test_mode']['default'],True)
        self.assertEqual([t['event'] for t in BLUEPRINT['triggers']],['start','end'])
        self.assertEqual(BLUEPRINT['mode'],'parallel')
    def test_switch_start_and_end(self):
        self.assertEqual(ActionRunner().commands(),[('switch.turn_on',{},dict(entity_id='switch.heat'))])
        r=ActionRunner(phase='end',end_actions=[dict(target='heat',op='off')])
        self.assertEqual(r.commands(),[('switch.turn_off',{},dict(entity_id='switch.heat'))])
    def test_no_end_action_for_point_programme(self):
        self.assertEqual(ActionRunner(phase='end').commands(),[])
    def test_gate_and_other_supported_services(self):
        for target,op,service,entity in [('gate','open','cover.open_cover','cover.gate'),('gate','close','cover.close_cover','cover.gate'),('light','on','light.turn_on','light.shop'),('scene','run','scene.turn_on','scene.day'),('script','run','script.simple',None)]:
            with self.subTest(target=target,op=op):
                calls=ActionRunner(actions=[dict(target=target,op=op)]).commands();self.assertEqual(calls[0][0],service)
                if entity:self.assertEqual(calls[0][2]['entity_id'],entity)
    def test_frech_preserves_checked_script_and_parameters(self):
        calls=ActionRunner(actions=[dict(target='frech',op='start')]).commands()
        self.assertEqual(calls,[('script.start',dict(switch_entity='switch.f1',input_entity='binary_sensor.f1',frech_number=1,wait_time=10),{})])
    def test_test_mode_no_commands_at_either_phase(self):
        for phase in ['start','end']:
            r=ActionRunner(phase=phase,test=True,end_actions=[dict(target='heat',op='off')]);self.assertEqual(r.commands(),[])
            self.assertTrue(any(c[0]=='persistent_notification.create' for c in r.calls))
    def test_deleted_moved_or_changed_event_never_uses_cached_trigger(self):
        for phase in ['start','end']:
            for change in ['delete','move','description']:
                with self.subTest(phase=phase,change=change):
                    r=ActionRunner(phase=phase,end_actions=[dict(target='heat',op='off')])
                    if change=='delete':r.events['calendar.group']=[]
                    elif change=='move':r.events['calendar.group'][0]['start']='2026-11-24T06:00:00+01:00'
                    else:r.events['calendar.group'][0]['description']='{}'
                    self.assertEqual(r.commands(),[])
    def test_unknown_disabled_invalid_duplicate_and_empty_actions_block(self):
        for actions in [[dict(target='unknown',op='on')],[dict(target='heat',op='open')],[dict(target='heat',op='on')]*2,[],None,'bad']:
            r=ActionRunner();r.change_meta(lambda m:m.update(start_actions=actions));self.assertEqual(r.commands(),[])
        r=ActionRunner();r.inputs['action_catalog']['heat']['enabled']=False;self.assertEqual(r.commands(),[])
    def test_bad_end_selection_also_blocks_start(self):
        r=ActionRunner(end_actions=[dict(target='unknown',op='off')]);self.assertEqual(r.commands(),[])
    def test_calendar_metadata_cannot_supply_an_entity_or_service(self):
        r=ActionRunner();r.change_meta(lambda m:m.update(entity_id='switch.forged',service='switch.turn_off'))
        self.assertEqual(r.commands(),[('switch.turn_on',{},dict(entity_id='switch.heat'))])
        r=ActionRunner(actions=[dict(target='switch.forged',op='on')]);self.assertEqual(r.commands(),[])
    def test_recheck_before_each_command(self):
        r=ActionRunner(actions=[dict(target='heat',op='on'),dict(target='frech',op='start')])
        r.after_command=lambda runner:runner.events['calendar.group'].clear()
        self.assertEqual(len(r.commands()),1)
    def test_late_triggers_calendar_failure_and_unavailable_entities(self):
        r=ActionRunner();r.now+=timedelta(minutes=2);self.assertEqual(r.commands(),[])
        r=ActionRunner();r.broken_response=True;self.assertEqual(r.commands(),[])
        r=ActionRunner();r.states['switch.heat']='unavailable';self.assertEqual(r.commands(),[])
        r=ActionRunner(actions=[dict(target='frech',op='start')]);r.states['script.start']='on';self.assertEqual(r.commands(),[])
    def test_legacy_events_ignored_by_new_executor(self):
        r=ActionRunner();r.change_meta(lambda m:m.update(planning=1,planning_chauffe=1,kind='weekly'));self.assertEqual(r.commands(),[])

if __name__=='__main__':unittest.main()
