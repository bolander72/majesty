import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import tomllib
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('movement_template',
    ROOT / 'scripts/prepare-community-movement-template.py')
movement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(movement)


@unittest.skipUnless(os.environ.get('MAJESTY_GAME_SOURCE'), 'Requires original game input')
class MovementTemplateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.game = self.root / 'game'
        self.source = self.root / 'source'
        (self.game / 'original').mkdir(parents=True)
        (self.source / 'resources').mkdir(parents=True)
        original = Path(os.environ['MAJESTY_GAME_SOURCE']) / 'MajestyHD - Old.exe'
        (self.game / 'original/Game.exe').symlink_to(original)
        for name in ['kit', 'analysis']:
            (self.game / name).mkdir()
        (self.game / 'globals.toml').write_text('')
        (self.game / 'overrides.h').write_text('// owned fixture\n')
        (self.game / 'game.toml').write_text(f'''[game]
developer_exe = "original/Game.exe"
sha256 = "{movement.PIN}"
[translate]
instruction_patches = [
]
native = {{header="overrides.h",sources=[]}}
''')
        (self.source / 'resources/features.bin').write_bytes(b'bound-private-feature-input')
        (self.source / 'source-stage.json').write_text(json.dumps({
            'resourceFiles': {'features.bin': movement.digest(self.source / 'resources/features.bin')}}))
        self.args = SimpleNamespace(game=self.game, source=self.source, out=self.root / 'output')

    def test_only_private_instruction_curation_changes(self):
        config = (self.game / 'game.toml').read_bytes()
        original = movement.digest(self.game / 'original/Game.exe')
        movement.prepare(self.args)
        before = tomllib.loads(config.decode())
        after = tomllib.loads((self.args.out / 'game.toml').read_text())
        self.assertEqual(after['translate'].pop('instruction_patches'),
                         [{'at': 0x005b75a2, 'text': 'CALL 0x005b7360'}])
        before['translate'].pop('instruction_patches')
        self.assertEqual(after, before)
        self.assertEqual((self.game / 'game.toml').read_bytes(), config)
        self.assertEqual(movement.digest(self.game / 'original/Game.exe'), original)
        self.assertTrue((self.args.out / 'overrides.h').is_symlink())
        report = json.loads((self.args.out / 'movement-template-stage.json').read_text())
        self.assertFalse(report['generatedSourcesEdited'])
        self.assertFalse(report['nativeQualified'])
        with self.assertRaisesRegex(ValueError, 'Preserve earlier'):
            movement.prepare(self.args)

    def test_changed_feature_binding_is_refused_before_creating_output(self):
        (self.source / 'resources/features.bin').write_bytes(b'different collection')
        with self.assertRaisesRegex(ValueError, 'Feature registry'):
            movement.prepare(self.args)
        self.assertFalse(self.args.out.exists())

    def test_existing_instruction_role_cannot_be_overwritten(self):
        p = self.game / 'game.toml'
        p.write_text(p.read_text().replace('instruction_patches = [\n',
                     'instruction_patches = [\n {at=0x005b75a2,text="NOP"},\n'))
        before = hashlib.sha256(p.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'collides'):
            movement.prepare(self.args)
        self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(), before)
        self.assertFalse(self.args.out.exists())

    def test_unrelated_public_patches_stay_in_original_host_only(self):
        p = self.game / 'game.toml'
        p.write_text(p.read_text().replace('instruction_patches = [\n',
                     'instruction_patches = [\n {at=0x004588f6,text="NOP"},\n'))
        original = p.read_bytes()
        movement.prepare(self.args)
        private = tomllib.loads((self.args.out / 'game.toml').read_text())
        self.assertEqual(private['translate']['instruction_patches'],
                         [{'at': 0x005b75a2, 'text': 'CALL 0x005b7360'}])
        self.assertEqual(p.read_bytes(), original)

    def test_actual_native_position_assembly_reuses_old_loan_but_not_new_loan(self):
        import pefile
        pe = pefile.PE(str(self.game / 'original/Game.exe'))
        code = pe.get_data(0x1b7490, 848)
        audit = movement.audit_frame(code)
        self.assertEqual(audit['loanOffset'], 0x18)
        self.assertTrue(audit['originalStackRestored'])
        with self.assertRaisesRegex(ValueError, r'reuses loan \+20'):
            movement.audit_frame(code, loan=0x20)
        # A changed native LEA that targets the new loan must fail closed too.
        changed = bytearray(code)
        at = 0x005b771f - 0x005b7490
        self.assertEqual(changed[at], 0x24)
        changed[at] = 0x1c
        with self.assertRaisesRegex(ValueError, r'reuses loan \+18'):
            movement.audit_frame(bytes(changed))
        for reserved in [0x0c, 0x50]:
            with self.assertRaisesRegex(ValueError, 'saved register or argument'):
                movement.audit_frame(code, loan=reserved)


if __name__ == '__main__':
    unittest.main()
