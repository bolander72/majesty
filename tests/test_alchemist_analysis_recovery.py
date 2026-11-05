import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analysis_recovery', ROOT / 'scripts/prepare-alchemist-analysis-recovery.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class AnalysisRecoveryTests(unittest.TestCase):
    def test_existing_destination_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sentinel = root / 'prior-analysis'
            sentinel.write_bytes(b'preserve')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                recovery.prepare(root, root, root, root, root)
            self.assertEqual(sentinel.read_bytes(), b'preserve')

    def test_hidden_project_path_is_rejected_before_creating_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / '.offloaded' / 'new-analysis'
            with self.assertRaisesRegex(ValueError, 'hidden elements'):
                recovery.prepare(root, root, root, root, output)
            self.assertFalse(output.exists())

    def test_altered_upstream_script_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            analyzer = root / 'analyze.py'
            analyzer.write_bytes(b'altered analyzer')
            with self.assertRaisesRegex(ValueError, 'unchanged upstream analyzer'):
                recovery.prepare(root, root, analyzer, root, root / 'fresh')
            self.assertFalse((root / 'fresh').exists())

    def test_executable_pin_checked_before_staging(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            analyzer = root / 'analyze.py'
            source = b'synthetic trusted analyzer'
            analyzer.write_bytes(source)
            blob = hashlib.sha1(b'blob ' + str(len(source)).encode() + b'\0' + source).hexdigest()
            (root / 'game.toml').write_text('[game]\nsha256="wrong executable"\n')
            with patch.object(recovery, 'ANALYZER_BLOB', blob):
                with self.assertRaisesRegex(ValueError, 'pinned DirectDraw'):
                    recovery.prepare(root, root, analyzer, root, root / 'fresh')
            self.assertFalse((root / 'fresh').exists())


if __name__ == '__main__':
    unittest.main()
