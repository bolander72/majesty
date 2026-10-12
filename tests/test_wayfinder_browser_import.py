import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('wayfinder_import', ROOT / 'scripts/prepare-wayfinder-browser-import.py')
IMPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORT)


class BrowserImportTests(unittest.TestCase):
    def source(self, directory, extra=None):
        path = directory / 'original.zip'
        files = {IMPORT.EXE: b'original-executable', IMPORT.CONFIG: b'original-config',
                 'Data/original.cam': b'untouched-data', 'Quests/mission.q': b'original-mission',
                 'QuestsMX/mission.q': b'expansion-mission', 'Music/music.mp3': b'music'}
        files.update(extra or {})
        with zipfile.ZipFile(path, 'w') as archive:
            for name, raw in files.items():
                archive.writestr(name, raw)
        return path, files

    def test_separate_artifact_preserves_original_archive_and_unrelated_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base, original = self.source(root)
            before = base.read_bytes()
            added = {'DataMX/' + name: name.encode() for name in IMPORT.RESOURCE_NAMES}
            added[IMPORT.CONFIG] = b'extended-config'
            with patch.object(IMPORT, 'EXE_SHA256', IMPORT.digest(original[IMPORT.EXE])), \
                    patch.object(IMPORT, 'resources', return_value=(added, IMPORT.digest(original[IMPORT.CONFIG]))):
                report = IMPORT.prepare(base, root, root, root / 'new-edition')
            self.assertEqual(base.read_bytes(), before)
            self.assertFalse(report['browserInstallationQualified'])
            with zipfile.ZipFile(root / 'new-edition/majesty-wayfinder-game.zip') as result:
                self.assertIsNone(result.testzip())
                for name, raw in original.items():
                    if name != IMPORT.CONFIG:
                        self.assertEqual(result.read(name), raw)
                for name, raw in added.items():
                    self.assertEqual(result.read(name), raw)

    def test_existing_output_is_preserved_before_any_input_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sentinel = root / 'keep.txt'
            sentinel.write_bytes(b'keep')
            with self.assertRaisesRegex(ValueError, 'Preserve existing output'):
                IMPORT.prepare(root / 'missing.zip', root, root, root)
            self.assertEqual(sentinel.read_bytes(), b'keep')

    def test_unsafe_duplicate_and_already_modified_source_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for extra in ({'../escape': b'x'}, {'Data\\escape': b'x'},
                          {'DATA/original.cam': b'case-collision'},
                          {'DataMX/Wayfinder.bcd': b'already-installed'},
                          {'DataMX/wayfinder.bcd': b'case-insensitive-mod-collision'}):
                path, _ = self.source(root, extra)
                with zipfile.ZipFile(path) as source, self.assertRaises(ValueError):
                    IMPORT.source_entries(source)

    def test_wrong_original_menu_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base, original = self.source(root)
            with patch.object(IMPORT, 'EXE_SHA256', IMPORT.digest(original[IMPORT.EXE])), \
                    patch.object(IMPORT, 'resources', return_value=({}, '0' * 64)), \
                    self.assertRaisesRegex(ValueError, 'Source configuration differs'):
                IMPORT.prepare(base, root, root, root / 'candidate')
            self.assertFalse((root / 'candidate').exists())

    def test_changed_real_resource_is_not_accepted_by_receipt_alone(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'Data').mkdir()
            data = b'not-the-qualified-bytecode'
            import json
            receipt = {'resourceIds': ['AVz1', 'ABs1'], 'interfaceId': 'APw1',
                       'files': {'Data/Wayfinder.bcd': {'bytes': len(data), 'sha256': IMPORT.digest(data)}}}
            raw = json.dumps(receipt).encode()
            (root / 'native-resources.json').write_bytes(raw)
            (root / 'Data/Wayfinder.bcd').write_bytes(data)
            (root / 'menu.json').write_text(json.dumps({
                'nativeResourceReceiptSha256': IMPORT.digest(raw),
                'missionBytecodeReloadGroups': ['Rel0', 'Rel2', 'Relp', 'Rel3']}))
            with self.assertRaisesRegex(ValueError, 'gameplay-qualified pack'):
                IMPORT.resources(root, root)


if __name__ == '__main__':
    unittest.main()
