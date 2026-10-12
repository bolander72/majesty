"""Compiler evidence must bind the fresh output to the exact official inputs."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.util.spec_from_file_location('compiled_wayfinder', ROOT / 'scripts/prepare-compiled-wayfinder-pack.py')
pack = importlib.util.module_from_spec(loader)
loader.loader.exec_module(pack)


class CompilerEvidenceChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.draft = self.root / 'draft'
        self.draft.mkdir()
        (self.draft / 'source.gpl').write_bytes(b'private source')
        report = dict(files={'source.gpl': dict(bytes=14, sha256=pack.sha(b'private source'))})
        (self.draft / 'authoring.json').write_text(json.dumps(report))
        self.compiler = self.root / 'compiler.exe'
        self.compiler.write_bytes(b'official compiler fixture')
        self.app = self.root / 'app.zip'
        self.make_app()
        self.bytecode = self.root / 'new.bcd'
        self.bytecode.write_bytes(struct.pack('<III', 24, 24, 0xffffffff) + bytes(16))
        common = dict(bytes=28, sha256=pack.sha(self.bytecode.read_bytes()), compilerExitCode=0)
        self.observed = self.root / 'observed.json'
        self.observed.write_text(json.dumps(dict(common, originalSDKCompilerSucceeded=True, ownedBrowserReleased=True, guardStopped=False)))
        self.runtime = self.root / 'runtime.json'
        self.runtime.write_text(json.dumps(dict(common, compilerFinished=True, compiled=True)))

    def make_app(self, compiler=b'official compiler fixture', stale=False):
        with zipfile.ZipFile(self.app, 'w') as z:
            z.writestr('wayfinder/Gplbcc.exe', compiler)
            z.writestr('wayfinder/source.gpl', b'private source')
            if stale:
                z.writestr('wayfinder/Data/old.bcd', bytes(28))
        self.stage = self.root / 'stage.json'
        self.stage.write_text(json.dumps(dict(files={self.app.name: dict(sha256=pack.sha(self.app.read_bytes()))})))

    def prepare(self):
        return pack.prepare(self.draft, self.bytecode, self.observed, self.runtime, self.stage, self.app, self.compiler)

    def test_valid_compile_stays_uninstalled_and_unqualified(self):
        files, report = self.prepare()
        self.assertEqual(files['Data/Wayfinder.bcd'], self.bytecode.read_bytes())
        self.assertTrue(report['bytecodeCompiled'])
        self.assertFalse(report['nativeIntegrationQualified'])
        self.assertFalse(report['installed'])
        self.assertFalse(report['published'])

    def test_incomplete_or_guard_stopped_trial_refused(self):
        original = self.observed.read_text()
        for field, value in [('originalSDKCompilerSucceeded', False), ('guardStopped', True), ('ownedBrowserReleased', False), ('compilerExitCode', 1)]:
            with self.subTest(field=field):
                data = json.loads(original)
                data[field] = value
                self.observed.write_text(json.dumps(data))
                with self.assertRaisesRegex(ValueError, 'Successful, closed'):
                    self.prepare()

    def test_changed_source_refused(self):
        (self.draft / 'source.gpl').write_bytes(b'changed source')
        with self.assertRaisesRegex(ValueError, 'Draft differs'):
            self.prepare()

    def test_changed_output_refused(self):
        raw = bytearray(self.bytecode.read_bytes())
        raw[-1] = 1
        self.bytecode.write_bytes(raw)
        with self.assertRaisesRegex(ValueError, 'Bytecode differs'):
            self.prepare()

    def test_invalid_container_refused(self):
        self.bytecode.write_bytes(bytes(28))
        with self.assertRaisesRegex(ValueError, 'Invalid SDK'):
            self.prepare()

    def test_substitute_compiler_refused(self):
        self.make_app(compiler=b'substitute')
        with self.assertRaisesRegex(ValueError, 'official SDK compiler'):
            self.prepare()

    def test_stale_bytecode_refused(self):
        self.make_app(stale=True)
        with self.assertRaisesRegex(ValueError, 'pre-existing bytecode'):
            self.prepare()

    def reuse_fixture(self):
        previous = self.root / 'previous'
        previous.mkdir()
        names = ['GPL/Wayfinder.gpl', 'GPL/Wayfinder_Data.dat', 'GPL/Wayfinder.gplproj',
                 'Data/Wayfinder_Characters.xml', 'Data/Wayfinder_Buildings.xml', 'Wayfinder.mmxml']
        records = {}
        with zipfile.ZipFile(self.app, 'w') as z:
            z.writestr('wayfinder/Gplbcc.exe', self.compiler.read_bytes())
            for name in names:
                raw = ('old fixture ' + name).encode()
                z.writestr('wayfinder/' + name, raw)
                for base in (previous, self.draft):
                    path = base / name
                    path.parent.mkdir(exist_ok=True)
                    path.write_bytes(raw)
                records[name] = dict(bytes=len(raw), sha256=pack.sha(raw))
        for base in (previous, self.draft):
            (base / 'authoring.json').write_text(json.dumps(dict(files=records)))
        self.stage.write_text(json.dumps(dict(files={self.app.name: dict(sha256=pack.sha(self.app.read_bytes()))})))
        return previous

    def update_record(self, name, raw):
        (self.draft / name).write_bytes(raw)
        report = json.loads((self.draft / 'authoring.json').read_text())
        report['files'][name] = dict(bytes=len(raw), sha256=pack.sha(raw))
        (self.draft / 'authoring.json').write_text(json.dumps(report))

    def test_resource_rebind_preserves_exact_original_compiler_proof(self):
        previous = self.reuse_fixture()
        self.update_record('Data/Wayfinder_Characters.xml', b'<Description ID="AVz1"/>')
        files, report = pack.prepare(self.draft, self.bytecode, self.observed, self.runtime,
                                    self.stage, self.app, self.compiler, previous)
        self.assertEqual(files['Data/Wayfinder_Characters.xml'], b'<Description ID="AVz1"/>')
        self.assertEqual(files['Data/Wayfinder.bcd'], self.bytecode.read_bytes())
        self.assertEqual(len(report['compilerInputReuse']['exactInputSha256']), 3)
        self.assertFalse(report['nativeIntegrationQualified'])

    def test_updated_receipt_cannot_hide_changed_compiler_input(self):
        previous = self.reuse_fixture()
        self.update_record('GPL/Wayfinder_Data.dat', b'changed prototype')
        with self.assertRaisesRegex(ValueError, 'fresh SDK compilation'):
            pack.prepare(self.draft, self.bytecode, self.observed, self.runtime,
                         self.stage, self.app, self.compiler, previous)

    def test_rebind_rejects_added_uncompiled_input(self):
        previous = self.reuse_fixture()
        report = json.loads((self.draft / 'authoring.json').read_text())
        report['files']['GPL/extra.gpl'] = dict(bytes=0, sha256=pack.sha(b''))
        (self.draft / 'authoring.json').write_text(json.dumps(report))
        with self.assertRaisesRegex(ValueError, 'complete known'):
            pack.prepare(self.draft, self.bytecode, self.observed, self.runtime,
                         self.stage, self.app, self.compiler, previous)


if __name__ == '__main__':
    unittest.main()
