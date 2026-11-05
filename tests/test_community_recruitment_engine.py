import importlib.util
import os
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('community_recruitment_engine',
    ROOT / 'scripts/prepare-community-recruitment-engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class RecruitmentEngineTests(unittest.TestCase):
    def test_wrong_executable_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'pinned'):
            engine.curate('', b'wrong executable')

    @unittest.skipUnless(os.environ.get('MAJESTY_GAME_SOURCE'), 'Requires original game input')
    def test_actual_curation_preserves_all_other_fields_and_is_idempotent(self):
        raw = (Path(os.environ['MAJESTY_GAME_SOURCE']) / 'MajestyHD - Old.exe').read_bytes()
        text = ('[game]\nsha256="' + engine.original.PIN + '"\n'
                '[translate]\nentry_points=[0x401000]\nother="unchanged"\n')
        result = engine.curate(text, raw)
        config = tomllib.loads(result)
        self.assertEqual(config['translate']['entry_points'], [0x401000, *engine.ENTRIES])
        config['translate']['entry_points'] = [0x401000]
        self.assertEqual(config, tomllib.loads(text))
        self.assertEqual(engine.curate(result, raw), result)
        with self.assertRaisesRegex(ValueError, 'another executable'):
            engine.curate(text.replace(engine.original.PIN, '0' * 64), raw)


if __name__ == '__main__':
    unittest.main()
