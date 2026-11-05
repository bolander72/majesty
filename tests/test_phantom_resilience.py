"""The balance stage must preserve unrelated gameplay and reject changed inputs."""
import ast
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
spec = importlib.util.spec_from_file_location('phantom_resilience',
    ROOT / 'scripts/prepare-phantom-resilience.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

SOURCE = b'''function Phantom_Ensure_Behavior_Watch(agent ThisAgent)
declare
begin
    $OriginalEnsure(ThisAgent);
end
function Phantom_Frost_Armor_Watch(agent ThisAgent)
declare
begin
    $OriginalWard(ThisAgent);
end
function StockHero() declare begin $OriginalStock(); end
function Eternal_Soul_Begin(agent thisagent, agent target)
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
'''


class PhantomResilienceTests(unittest.TestCase):
    def test_only_watcher_entries_and_three_overflowing_expressions_change(self):
        result = policy.adapt(SOURCE)
        self.assertEqual(result.count(b'$MJP_Phantom_Resilience(ThisAgent);'), 2)
        self.assertEqual(result.replace(b'    $MJP_Phantom_Resilience(ThisAgent);\n', b'')
            .replace(b'    $MJP_Phantom_Retreat(ThisAgent);\n', b''), SOURCE
            .replace(b'(base_max_hp * 30) / 100', b'(base_max_hp / 100) * 30 + ((base_max_hp % 100) * 30) / 100')
            .replace(b'((current_hp * boosted_max_hp) + (base_max_hp / 2)) / base_max_hp',
                     b'$MJP_Scale_Living_HP(current_hp, base_max_hp, boosted_max_hp)')
            .replace(b'((current_hp * base_max_hp) + (boosted_max_hp / 2)) / boosted_max_hp',
                     b'$MJP_Scale_Living_HP(current_hp, boosted_max_hp, base_max_hp)'))
        with self.assertRaisesRegex(ValueError, 'already applied'):
            policy.adapt(result)
        with self.assertRaises(Exception):
            policy.adapt(SOURCE.replace(b'Phantom_Frost_Armor_Watch', b'Changed_Watch'))

    def test_authored_scaler_is_exact_without_vm_intermediate_overflow(self):
        from majesty_cam.gpl import parse_gpl, DefinitionKind
        from majesty_cam.gpl_function_merge import _Parser
        source = (ROOT / 'content/community-mods/phantoms-haunt/resilience.gpl').read_text()
        helper = parse_gpl(source).require(DefinitionKind.FUNCTION, 'MJP_Scale_Living_HP').text
        _, declarations, body = _Parser(helper).function()
        class Returned(Exception): pass
        def run(hp, old, new):
            values = dict.fromkeys(declarations, 0)
            values.update(hp=hp, oldmax=old, newmax=new)
            steps = 0
            def evaluate(tokens):
                text = ' '.join(tokens).replace('||', ' or ').replace('&&', ' and ')
                def value(n):
                    if isinstance(n, ast.Constant): return n.value
                    if isinstance(n, ast.Name): return values[n.id]
                    if isinstance(n, ast.BoolOp):
                        xs = [value(x) for x in n.values]
                        return all(xs) if isinstance(n.op, ast.And) else any(xs)
                    if isinstance(n, ast.Compare):
                        a, b = value(n.left), value(n.comparators[0]); op = n.ops[0]
                        if isinstance(op, ast.Lt): return a < b
                        if isinstance(op, ast.Gt): return a > b
                        if isinstance(op, ast.GtE): return a >= b
                        if isinstance(op, ast.Eq): return a == b
                    a, b = value(n.left), value(n.right)
                    if isinstance(n.op, ast.Mult): result = a * b
                    elif isinstance(n.op, ast.Div): result = a // b
                    elif isinstance(n.op, ast.Mod): result = a % b
                    elif isinstance(n.op, ast.Add): result = a + b
                    elif isinstance(n.op, ast.Sub): result = a - b
                    else: raise AssertionError('Unsupported operation')
                    self.assertGreaterEqual(result, -2097152)
                    self.assertLessEqual(result, 2097151)
                    return result
                return value(ast.parse(text, mode='eval').body)
            def execute(nodes):
                nonlocal steps
                for n in nodes:
                    steps += 1; self.assertLess(steps, 5000)
                    if n.kind == 'if': execute(n.body if evaluate(n.head[2:-1]) else n.otherwise)
                    elif n.kind == 'while':
                        while evaluate(n.head[2:-2]): execute(n.body)
                    elif n.head[0] == 'return': raise Returned(evaluate(n.head[1:-1]))
                    else:
                        name, op = n.head[:2]; v = evaluate(n.head[2:-1])
                        if op == '=': values[name] = v
                        elif op == '+=': values[name] += v
                        elif op == '-=': values[name] -= v
                        else: raise AssertionError('Unsupported assignment')
            try: execute(body)
            except Returned as result: return result.args[0]
            raise AssertionError('No result')
        for old in [18, 36, 2016, 3500, 5031, 70000, 1000000]:
            for new in [old, old * 130 // 100, old * 100 // 130]:
                for hp in [1, old // 4, old // 2, old - 1, old]:
                    expected = max(1, min(new, (hp * new + old // 2) // old))
                    self.assertEqual(run(hp, old, new), expected)

    def fixture(self, directory):
        source = directory / 'original'
        payloads = {'Any/Merged.gpl': SOURCE, 'Any/Merged.dat': b'[end]\n',
            'Majesty/Merged.gpl': b'// original campaign\n',
            'MajestyExpansion/Merged.gpl': b'// Northern campaign\n'}
        for name, raw in payloads.items():
            path = source / 'sources' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        proof = dict(format='majesty-community-combined-creator-gpl-stage-v1',
            campaignResourceClosure={'verified': True},
            files={name: policy.digest(raw) for name, raw in payloads.items()})
        (source / 'source-stage.json').write_text(json.dumps(proof))
        return source, payloads

    def test_complete_stage_preserves_inputs_and_both_edition_scripts(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, payloads = self.fixture(root)
            policy.prepare(source, root / 'adapted')
            for name, raw in payloads.items():
                self.assertEqual((source / 'sources' / name).read_bytes(), raw)
                if name != 'Any/Merged.gpl':
                    self.assertEqual((root / 'adapted/sources' / name).read_bytes(), raw)
            proof = json.loads((root / 'adapted/source-stage.json').read_text())
            self.assertIn('Any/PhantomResilience.gpl', proof['files'])
            self.assertFalse(proof['compiled'])
            with self.assertRaisesRegex(ValueError, 'Preserve prior'):
                policy.prepare(source, root / 'adapted')
            (source / 'sources/Any/Merged.gpl').write_bytes(SOURCE + b'// changed')
            with self.assertRaisesRegex(ValueError, 'differs from its proof'):
                policy.prepare(source, root / 'refused')
            self.assertFalse((root / 'refused').exists())


if __name__ == '__main__':
    unittest.main()
