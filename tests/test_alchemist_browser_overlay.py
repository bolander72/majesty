import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import hashlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_overlay', ROOT / 'scripts/prepare-alchemist-browser-overlay.py')
overlay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overlay)


class BrowserOverlayTests(unittest.TestCase):
    def fixture(self, root):
        game = root / 'candidate/game'
        (game / 'Data').mkdir(parents=True)
        (game / 'DataMX').mkdir()
        (game / 'MajestyHD - Old.exe').write_bytes(b'exe')
        (game / 'Data/original.cam').write_bytes(b'changed')
        (game / 'DataMX/art.cam').write_bytes(b'art')
        archive = root / 'original.zip'
        with zipfile.ZipFile(archive, 'w') as target:
            target.writestr('MajestyHD - Old.exe', b'exe')
            target.writestr('Data/original.cam', b'original')
        return game, archive

    def test_original_bytes_preserved_and_replacements_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            game, archive = self.fixture(root)
            original = archive.read_bytes()
            with patch.object(overlay, 'EXE_SHA', hashlib.sha256(b'exe').hexdigest()):
                report = overlay.prepare(archive, game.parent, root / 'overlay.json')
            self.assertEqual(archive.read_bytes(), original)
            self.assertEqual(len(report['patches']), 2)
            by_name = {p['path']: p for p in report['patches']}
            self.assertEqual(by_name['Data/original.cam']['baseSha256'], hashlib.sha256(b'original').hexdigest())
            self.assertIsNone(by_name['DataMX/art.cam']['baseSha256'])
            self.assertFalse(report['published'])

    def test_conflicting_case_is_refused_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            game, archive = self.fixture(root)
            (game / 'Data/original.cam').rename(game / 'Data/ORIGINAL.cam')
            with patch.object(overlay, 'EXE_SHA', hashlib.sha256(b'exe').hexdigest()):
                with self.assertRaisesRegex(ValueError, 'spelling conflicts'):
                    overlay.prepare(archive, game.parent, root / 'overlay.json')
            self.assertFalse((root / 'overlay.json').exists())


if __name__ == '__main__':
    unittest.main()
