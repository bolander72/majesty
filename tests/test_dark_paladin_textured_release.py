"""Publication gate rejects incomplete art reviews and unreviewed source/data."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('textured_release',ROOT/'scripts/lib/dark_paladin_textured_release.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
REQUIRED=['nativeArtQualified','heroAnimationsQualified','allTiersQualified','guildPanelQualified','saveReloadQualified','ownedBrowserClosed','engineUnchanged','statsAndScriptsUnchanged']
class TexturedReleaseGate(unittest.TestCase):
    def fixture(self,root,proof):
        (root/'deploy').mkdir();out=root/'output';out.mkdir();(out/'unexpected.txt').write_text('unreviewed')
        raw=json.dumps(proof).encode();(root/'deploy/dark-paladin-textured-verification.json').write_bytes(raw)
        d={'format':'majesty-dark-paladin-textured-release-v1','qualification':r.digest(raw),'installer':r.digest((ROOT/'scripts/lib/dark_paladin_textured_release.py').read_bytes()),'baselineFiles':{}}
        (root/'deploy/dark-paladin-textured-release.json').write_text(json.dumps(d));return out
    def test_every_native_qualification_is_required(self):
        for key in REQUIRED:
            with self.subTest(key=key),tempfile.TemporaryDirectory()as t:
                proof={**dict.fromkeys(REQUIRED,True),'sourcePolicies':{}};proof[key]=False
                root=Path(t);out=self.fixture(root,proof)
                with self.assertRaisesRegex(ValueError,'completed native textured-art qualification'):r.install(root,out)
    def test_unreviewed_production_baseline_is_rejected_before_download(self):
        with tempfile.TemporaryDirectory()as t:
            root=Path(t);out=self.fixture(root,{**dict.fromkeys(REQUIRED,True),'sourcePolicies':{}})
            with self.assertRaisesRegex(ValueError,'current production baseline'):r.install(root,out)
    def test_changed_art_source_is_rejected_before_download(self):
        with tempfile.TemporaryDirectory()as t:
            root=Path(t);(root/'art.py').write_text('changed')
            out=self.fixture(root,{**dict.fromkeys(REQUIRED,True),'sourcePolicies':{'art.py':'0'*64}})
            with self.assertRaisesRegex(ValueError,'textured-art source changed'):r.install(root,out)
if __name__=='__main__':unittest.main()
