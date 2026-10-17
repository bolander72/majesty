import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'community_browser_engine', ROOT / 'scripts/prepare-community-browser-engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class BrowserCoreLinkTests(unittest.TestCase):
    def rule(self):
        objects = ['host/main.cpp.o',
                   *['host/CMakeFiles/recomp_app_mod_alchemist_native_probe.dir/' + x + '.o'
                     for x in ['entry.cpp', 'support/a.cpp', 'support/b.cpp']],
                   'host/CMakeFiles/recomp_app.dir/__/generated/recomp_app_builtin_mods.c.o']
        return ('build /owned/MajestyRecomp.js: CXX_EXECUTABLE_LINKER__recomp_app_Release ' +
                ' '.join(objects) + ' || host\n' +
                '  LINK_FLAGS = -pthread -sWASMFS -sINVOKE_RUN=0 --preload-file /owned/resources@/app/resources\n' +
                '  LINK_LIBRARIES = -Wl,--whole-archive lib/librecomp_gen.a -Wl,--no-whole-archive -lm\n\n')

    def test_retains_original_host_and_removes_only_previous_core(self):
        rule = engine.web_rule(self.rule(), '/owned/MajestyRecomp.js')
        self.assertEqual(rule['objects'], ['host/main.cpp.o'])
        self.assertEqual(len(rule['removed']), 4)
        self.assertNotIn('--preload-file', rule['flags'])
        self.assertEqual(rule['resources'], '/owned/resources')
        self.assertIn('lib/librecomp_gen.a', rule['libraries'])

    def test_rejects_unknown_or_extra_builtin(self):
        for text in [self.rule().replace('support/b.cpp.o', 'support/b.cpp.bad'),
                     self.rule().replace(' || host', ' host/recomp_app_mod_other.dir/core.cpp.o || host')]:
            with self.assertRaises(ValueError):
                engine.web_rule(text, '/owned/MajestyRecomp.js')

    def test_requires_one_original_threaded_resource_mount(self):
        for old, new in [('-pthread ', ''), ('@/app/resources', '@/elsewhere'),
                         (' --preload-file ', ' --preload-file /other@/app/resources --preload-file ')]:
            with self.assertRaises(ValueError):
                engine.web_rule(self.rule().replace(old, new), '/owned/MajestyRecomp.js')

    def test_refuses_ambiguous_or_missing_original_link_rule(self):
        for text in ['', self.rule() * 2]:
            with self.assertRaises(ValueError):
                engine.web_rule(text, '/owned/MajestyRecomp.js')


if __name__ == '__main__':
    unittest.main()
