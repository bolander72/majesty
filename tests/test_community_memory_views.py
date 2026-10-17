import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('browser_memory_views',
    Path(__file__).resolve().parents[1] / 'scripts/pin-browser-memory-views.py')
views = importlib.util.module_from_spec(spec)
spec.loader.exec_module(views)


class BrowserMemoryViewTests(unittest.TestCase):
    def original(self):
        return ('before();\nfunction getMemoryBuffer() {\n'
                '  try {\n    var b = wasmMemory.toResizableBuffer();\n'
                '    growMemViews = () => {};\n    return b;\n  } catch {}\n'
                '  return wasmMemory.buffer;\n}\nafter();\n')

    def test_pins_only_selector_and_is_idempotent(self):
        out = views.pin_views(self.original())
        self.assertEqual(out, 'before();\n' + views.PINNED + '\nafter();\n')
        self.assertEqual(views.pin_views(out), out)
        self.assertNotIn('growMemViews =', out)

    def test_unknown_or_duplicate_selector_fails_closed(self):
        for text in ['', self.original() * 2, self.original().replace('toResizableBuffer', 'newSdkView')]:
            with self.assertRaises(ValueError):
                views.pin_views(text)
