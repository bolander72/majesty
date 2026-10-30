from pathlib import Path
import importlib.util,unittest
ROOT=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('opacity',ROOT/'scripts/prepare-dark-paladin-opacity-gpl.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OpacityRepair(unittest.TestCase):
 def test_normal_decision_entry_repair_preserves_real_spell_control_and_all_other_functions(self):
  text='function Unrelated ()\nbegin\n $debugout("unchanged");\nend\n\nfunction Dark_Paladin_tree_mh (agent thisagent)\ndeclare\nbegin\n $SpecifyIntent(thisagent,42);\nend\n'
  new=m.repair(text);self.assertEqual(new.replace(m.GUARD,''),text)
  for effect in ['Petrify','Camouflage','Invisibility','IllusionaryHero']:self.assertIn('#ATTRIB_HasEffect'+effect+') == 0',new)
  self.assertEqual(new.count('$ClearDrawEffects(thisagent)'),1);self.assertEqual(new.count('$SetDrawEffects(thisagent,"none",0)'),1)
if __name__=='__main__':unittest.main()
