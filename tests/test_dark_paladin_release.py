import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dark_release',ROOT/'scripts/lib/dark_paladin_release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)


class ProductionCacheIdentity(unittest.TestCase):
    def test_new_engine_gets_fresh_cache_urls_without_changing_data_or_other_routes(self):
        before={n:c*64 for n,c in [('MajestyRecomp.js','a'),('MajestyRecomp.data','b'),('MajestyRecomp.wasm','c')]}
        after={**before,'MajestyRecomp.js':'d'*64,'MajestyRecomp.wasm':'e'*64}
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);(root/'static').mkdir()
            html='<html><script>const versions = '+json.dumps(before)+';\nconst untouched = 1;</script></html>'
            (root/'static/index.html').write_text(html)
            routes=[{'src':'/majesty/'+n.replace('.',r'\.'),'has':[{'type':'query','key':'v','value':h}],'headers':{'Cache-Control':'public, max-age=31536000, immutable'}}for n,h in before.items()]
            routes.append({'src':'/','dest':'/index.html'})
            (root/'config.json').write_text(json.dumps({'routes':routes},indent=2)+'\n')
            original=release.inventory(root)
            release.advance_engine_cache(root,before,after)
            self.assertEqual((root/'static/index.html').read_text(),html.replace(json.dumps(before),json.dumps(after)))
            actual=json.loads((root/'config.json').read_text())['routes']
            self.assertEqual(actual[-1],routes[-1]);self.assertEqual(actual[1],routes[1])
            for i,n in enumerate(before):self.assertEqual(actual[i]['has'][0]['value'],after[n])
            release.advance_engine_cache(root,after,before)
            self.assertEqual(release.inventory(root),original)

    def test_stale_launcher_identity_is_rejected(self):
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);(root/'static').mkdir();(root/'static/index.html').write_text('const versions = {};')
            with self.assertRaisesRegex(ValueError,'launcher engine cache'):
                release.advance_engine_cache(root,{'MajestyRecomp.js':'a'*64},{'MajestyRecomp.js':'b'*64})

    def test_unreviewed_baseline_is_rejected_before_network_access(self):
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);(root/'deploy').mkdir();output=root/'output';output.mkdir();(output/'unreviewed.txt').write_text('changed')
            sha='a'*64
            proof={'baselineEngineSha256':sha,'sourcePolicies':{}}
            for key in ['nativeConstructRecruitCombatQualified','freshLevel1000SaveReloadQualified','nativeUiQualified','nativeUpgradeChainQualified','otherRetiredAdmissionsDisabled','stockResourcesPreserved','existingSaveHashesPreserved','ownedBrowsersClosed']:proof[key]=True
            raw=json.dumps(proof).encode();(root/'deploy/dark-paladin-preview-verification.json').write_bytes(raw)
            (root/'deploy/hosted-release.json').write_text(json.dumps({'engineSha256':sha}))
            descriptor={'format':'majesty-dark-paladin-production-delta-v1','previewQualification':release.digest(raw),'baselineEngineSha256':sha,'installer':release.digest((ROOT/'scripts/lib/dark_paladin_release.py').read_bytes()),'baselineFiles':{}}
            (root/'deploy/dark-paladin-release.json').write_text(json.dumps(descriptor))
            with self.assertRaisesRegex(ValueError,'Baseline build differs'):
                release.install(root,output)


if __name__=='__main__':unittest.main()
