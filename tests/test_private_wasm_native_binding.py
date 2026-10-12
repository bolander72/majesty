"""Reject unqualified or stale native inputs before a private WASM build starts."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('private_wasm_builder', ROOT / 'scripts/build-private-resume073-wasm.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NativeBindingChecks(unittest.TestCase):
    def fixture(self, root):
        (root / 'source.cpp').write_bytes(b'qualified native source')
        record = dict(nativeBuildQualified=True, exitCode=0)
        digest = hashlib.sha256((root / 'source.cpp').read_bytes()).hexdigest()
        for key in ('nativeSourceSha256', 'nativeHeapRuntimeSourceSha256',
                    'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256'):
            record[key] = {'source.cpp': digest}
        return record

    def test_exact_source_and_finished_build_required(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            record = self.fixture(root)
            receipt = root / 'receipt.json'
            receipt.write_text(json.dumps(record))
            self.assertEqual(builder.qualified_native_inputs(receipt, root), record['nativeSourceSha256'])
            for change in [dict(exitCode=None), dict(exitCode=1), dict(nativeBuildQualified=False),
                           dict(nativeOrderRuntimeSourceSha256={})]:
                receipt.write_text(json.dumps(record | change))
                with self.subTest(change=change), self.assertRaises(ValueError):
                    builder.qualified_native_inputs(receipt, root)
            receipt.write_text(json.dumps(record))
            (root / 'source.cpp').write_bytes(b'later source change')
            with self.assertRaisesRegex(ValueError, 'changed'):
                builder.qualified_native_inputs(receipt, root)


if __name__ == '__main__':
    unittest.main()
