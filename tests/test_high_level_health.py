"""Execute the authored GPL arithmetic with bounded VM-sized intermediates."""
import ast
import importlib.util
import json
from pathlib import Path
import random
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import parse_gpl, DefinitionKind
from majesty_cam.gpl_function_merge import _Parser


class HighLevelHealthTests(unittest.TestCase):
    def run_percentage(self, hp, maximum):
        text = (ROOT / 'content/community-mods/high-level-health.gpl').read_text()
        function = parse_gpl(text).require(DefinitionKind.FUNCTION, 'MJP_Health_Percent').text
        _, declarations, body = _Parser(function).function()
        values = dict.fromkeys(declarations, 0)
        values.update(hp=hp, maxhp=maximum)
        steps = 0

        def bounded(value):
            if type(value) is int:
                self.assertGreaterEqual(value, -2097152)
                self.assertLessEqual(value, 2097151)
            return value

        def expression(tokens):
            def ev(n):
                if isinstance(n, ast.Constant):
                    return n.value
                if isinstance(n, ast.Name):
                    return values[n.id]
                if isinstance(n, ast.BoolOp):
                    return any(ev(x) for x in n.values) if isinstance(n.op, ast.Or) else all(ev(x) for x in n.values)
                if isinstance(n, ast.Compare):
                    a, b = ev(n.left), ev(n.comparators[0])
                    op = n.ops[0]
                    if isinstance(op, ast.Lt): return a < b
                    if isinstance(op, ast.Gt): return a > b
                    if isinstance(op, ast.GtE): return a >= b
                    if isinstance(op, ast.Eq): return a == b
                    raise AssertionError('Unsupported comparison')
                a, b = ev(n.left), ev(n.right)
                if isinstance(n.op, ast.Add): return bounded(a + b)
                if isinstance(n.op, ast.Sub): return bounded(a - b)
                if isinstance(n.op, ast.Mult): return bounded(a * b)
                if isinstance(n.op, ast.Div): return bounded(a // b)
                if isinstance(n.op, ast.Mod): return bounded(a % b)
                raise AssertionError('Unsupported expression')
            return ev(ast.parse(' '.join(tokens).replace('||', ' or ').replace('&&', ' and '), mode='eval').body)

        class Returned(Exception):
            pass

        def execute(nodes):
            nonlocal steps
            for n in nodes:
                steps += 1
                self.assertLess(steps, 300)
                if n.kind == 'if':
                    execute(n.body if expression(n.head[2:-1]) else n.otherwise)
                elif n.kind == 'while':
                    while expression(n.head[2:-2]): execute(n.body)
                elif n.head[0] == 'return':
                    raise Returned(expression(n.head[1:-1]))
                else:
                    name, op = n.head[:2]
                    value = expression(n.head[2:-1])
                    if op == '=': values[name] = bounded(value)
                    elif op == '+=': values[name] = bounded(values[name] + value)
                    elif op == '-=': values[name] = bounded(values[name] - value)
                    else: raise AssertionError('Unsupported assignment')
        try:
            execute(body)
        except Returned as answer:
            return answer.args[0]
        self.fail('GPL helper did not return')

    def test_original_floor_percentage_is_exact_through_vm_limit(self):
        rng = random.Random(20261112)
        maxima = [1, 18, 100, 2016, 20971, 20972, 70000, 1000000, 2097151]
        maxima += [rng.randrange(1, 2097152) for _ in range(30)]
        for maximum in maxima:
            for hp in sorted({0, 1, maximum // 4, maximum // 2, maximum - 1, maximum}):
                self.assertEqual(self.run_percentage(hp, maximum), min(100, hp * 100 // maximum))
        self.assertEqual(self.run_percentage(0, 0), 0)
        self.assertEqual(self.run_percentage(100, 0), 0)

    def test_large_health_old_intermediate_overflows_but_percentage_does_not(self):
        self.assertGreater(70000 * 100, 2097151)
        self.assertEqual(self.run_percentage(70000, 100000), 70)
        self.assertEqual(self.run_percentage(1, 100000), 0)  # No rounding-up balance change.

    def test_changed_sources_refuse_instead_of_guessing(self):
        spec = importlib.util.spec_from_file_location('health_policy', ROOT / 'scripts/prepare-community-high-level-health.py')
        policy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(policy)
        # The full retained-input witness is verified separately; this fixture
        # checks that the adapter never silently accepts a different source shape.
        with self.assertRaises(Exception):
            policy.adapt(b'function Changed() declare begin end', 'function Changed() declare begin end')
        with self.assertRaisesRegex(ValueError, 'already present'):
            policy.adapt(b'// MJP_Health_Percent', '')

    def source_fixture(self):
        source = '''function Eternal_Soul_Begin(agent thisagent, agent target)
declare integer bonus_max_hp,base_max_hp,boosted_hp,current_hp,boosted_max_hp;
begin
bonus_max_hp = (base_max_hp * 30) / 100;
boosted_hp = ((current_hp * boosted_max_hp) + (base_max_hp / 2)) / base_max_hp;
end
function Eternal_Soul_End(agent thisagent)
declare integer restored_hp,current_hp,base_max_hp,boosted_max_hp;
begin
restored_hp = ((current_hp * base_max_hp) + (boosted_max_hp / 2)) / boosted_max_hp;
end
function Eval_For_Healing(agent ThisAgent, integer Distance) is agent
declare agent Hero; integer Percent_HP;
begin
Percent_HP = ($GetAttribute(Hero, #ATTRIB_HP) * 100) /
 $GetAttribute(Hero, #ATTRIB_MaxHP);
return Hero;
end
function Life_Leach_Hit(agent thisagent, agent target)
declare begin $Spell_Attack(thisagent,target,15); end
function Other_Hero_Birth(agent thisagent)
declare begin $Original_Birth(thisagent); end
'''
        stock = '''function haslowHP(agent thisagent) is boolean
declare integer HP,maxHP;
begin
if (((HP * 100) / maxHP) <= thisagent's "PercentageHPretreat") return TRUE;
else return FALSE;
end'''
        return source, stock

    def test_adapter_preserves_damage_and_unrelated_function_bodies(self):
        spec = importlib.util.spec_from_file_location('health_policy', ROOT / 'scripts/prepare-community-high-level-health.py')
        policy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(policy)
        source, stock = self.source_fixture()
        result = policy.adapt(source.encode(), stock).decode()
        before = {i.key: i.text for i in parse_gpl(source).items}
        after = {i.key: i.text for i in parse_gpl(result).items}
        for name in ['life_leach_hit', 'other_hero_birth']:
            self.assertEqual(before[DefinitionKind.FUNCTION, name], after[DefinitionKind.FUNCTION, name])
        rule = after[DefinitionKind.FUNCTION, 'haslowhp']
        self.assertIn('$MJP_Health_Percent(HP, maxHP)', rule)
        self.assertIn('PercentageHPretreat', rule)

    def prepare_fixture(self, root):
        spec = importlib.util.spec_from_file_location('health_policy', ROOT / 'scripts/prepare-community-high-level-health.py')
        policy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(policy)
        source_text, stock = self.source_fixture()
        source = root / 'original'
        payloads = {'Any/Merged.gpl': source_text.encode(), 'Any/Merged.dat': b'[end]\n',
                    'Any/Unrelated.gpl': b'// preserve unrelated module\n',
                    'Majesty/Merged.gpl': b'// original campaign\n',
                    'MajestyExpansion/Merged.gpl': b'// Northern campaign\n'}
        for name, raw in payloads.items():
            p = source / 'sources' / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(raw)
        proof = dict(format='majesty-community-combined-creator-gpl-stage-v1',
                     files={name: policy.digest(raw) for name, raw in payloads.items()})
        (source / 'source-stage.json').write_text(json.dumps(proof))
        sdk_name = 'SDK/OriginalQuests/GPL/LowLevel.gpl'
        sdk = root / '.tools/majesty-sdk' / sdk_name
        sdk.parent.mkdir(parents=True)
        sdk.write_bytes(stock.encode())
        manifest = root / 'output/recovery-2026-11-08/sdk-manifest.json'
        manifest.parent.mkdir(parents=True)
        manifest.write_text(json.dumps(dict(files={sdk_name: policy.digest(sdk.read_bytes())})))
        for name in ('phantoms-haunt/resilience.gpl', 'high-level-health.gpl'):
            target = root / 'content/community-mods' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((ROOT / 'content/community-mods' / name).read_bytes())
        return policy, source, payloads, proof

    def test_complete_stage_preserves_sources_and_is_not_runtime_qualified(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            policy, source, payloads, _ = self.prepare_fixture(root)
            prior_proof = (source / 'source-stage.json').read_bytes()
            out = root / 'adapted'
            with patch.object(policy, 'ROOT', root):
                policy.prepare(source, out)
                with self.assertRaisesRegex(ValueError, 'Preserve earlier'):
                    policy.prepare(source, out)
            self.assertEqual((source / 'source-stage.json').read_bytes(), prior_proof)
            for name, raw in payloads.items():
                self.assertEqual((source / 'sources' / name).read_bytes(), raw)
                if name != 'Any/Merged.gpl':
                    self.assertEqual((out / 'sources' / name).read_bytes(), raw)
            proof = json.loads((out / 'source-stage.json').read_bytes())
            for name, expected in proof['files'].items():
                self.assertEqual(policy.digest((out / 'sources' / name).read_bytes()), expected)
            helpers = parse_gpl((out / 'sources/Any/HighLevelHealth.gpl').read_text())
            for name in ('MJP_Scale_Living_HP', 'MJP_Health_Percent'):
                helpers.require(DefinitionKind.FUNCTION, name)
            for flag in ('compiled', 'targetNativeABIQualified', 'browserPlayable', 'published'):
                self.assertFalse(proof[flag])

    def test_existing_health_module_is_refused_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            policy, source, _, proof = self.prepare_fixture(root)
            name, raw = 'Any/HighLevelHealth.gpl', b'// existing independent source\n'
            (source / 'sources' / name).write_bytes(raw)
            proof['files'][name] = policy.digest(raw)
            (source / 'source-stage.json').write_text(json.dumps(proof))
            out = root / 'refused'
            with patch.object(policy, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'Preserve existing HighLevelHealth'):
                    policy.prepare(source, out)
            self.assertFalse(out.exists())
            self.assertEqual((source / 'sources' / name).read_bytes(), raw)

    def test_changed_stage_file_is_refused_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            policy, source, _, _ = self.prepare_fixture(root)
            (source / 'sources/Majesty/Merged.gpl').write_bytes(b'// changed campaign\n')
            out = root / 'refused'
            with patch.object(policy, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'Source changed: Majesty/Merged.gpl'):
                    policy.prepare(source, out)
            self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
