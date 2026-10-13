import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('retirement_build',ROOT/'scripts/build-vercel.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)

class ContentRetirement(unittest.TestCase):
    def test_live_catalogs_drop_retired_packs_without_changing_original_assets(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'hosting').mkdir()
            games=[{'id':'majesty','title':'Original','defaultContentStorageId':'majesty-lost-trail-v2',
                'contentStorageId':'majesty-lost-trail'},*({'id':id}for id in ['majesty-wayfinder','majesty-lost-trail','majesty-lost-trail-v2'])]
            assets={'format':'majesty-automatic-assets-v1','games':{'majesty':{'bytes':500,'sha256':'original'},
                **{g['id']:{'archived':True}for g in games[1:]}}}
            (root/'games.json').write_text(json.dumps(games));(root/'hosting/automatic-assets.json').write_text(json.dumps(assets))
            build.retire_custom_content(root)
            self.assertEqual(json.loads((root/'games.json').read_text()),[{'id':'majesty','title':'Original'}])
            self.assertEqual(json.loads((root/'hosting/automatic-assets.json').read_text())['games'],{'majesty':assets['games']['majesty']})

    def test_archived_descriptors_do_not_reenable_content_or_require_new_downloads(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'deploy').mkdir();old=build.ROOT;build.ROOT=root
            try:
                for name in ['content-release.json','content-v2-release.json']:
                    (root/'deploy'/name).write_text(json.dumps({'retired':True}))
                build.install_content_release(root/'absent-output');build.install_content_v2_release(root/'absent-output')
                self.assertFalse((root/'absent-output').exists())
            finally:build.ROOT=old

if __name__=='__main__':unittest.main()
