import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_creator_baseline import digest, verify_creator_baseline


class RecoveredCreatorTests(unittest.TestCase):
    def fixture(self, root):
        source, compiled = root / 'source', root / 'compiled'
        (source / 'sources/Any').mkdir(parents=True)
        compiled.mkdir()
        raw = b'// preserved creator source\n'
        (source / 'sources/Any/Merged.gpl').write_bytes(raw)
        stage = dict(format='majesty-community-combined-creator-gpl-stage-v1',
                     files={'Any/Merged.gpl': digest(raw)})
        (source / 'source-stage.json').write_text(json.dumps(stage))
        outputs = {}
        for scope in ('common', 'base', 'expansion'):
            data = (scope + ' original compiler output').encode()
            (compiled / (scope + '.bcd')).write_bytes(data)
            outputs[scope] = dict(**digest(data), sourceDefinitions=1, compiledDefinitions=1,
                                  exitCode=0, headerValid=True)
        reference = dict(sourceStage=digest(b'lost original manifest'), compilerSha256='original-sdk-pin',
                         outputs=outputs)
        proof = dict(format='majesty-community-original-sdk-compile-v1',
                     compilerSha256=reference['compilerSha256'],
                     sourceStage=digest((source / 'source-stage.json').read_bytes()),
                     outputs=copy.deepcopy(outputs), compiled=True,
                     compilerSourceDefinitionsQualified=True, compiledBytesExportedQualified=True)
        (compiled / 'compiler-proof.json').write_text(json.dumps(proof))
        return source, compiled, reference, proof

    def test_recovery_requires_all_original_outputs_without_claiming_manifest_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, compiled, reference, _ = self.fixture(Path(tmp))
            with self.assertRaisesRegex(ValueError, 'independently compiled'):
                verify_creator_baseline(source, reference)
            result = verify_creator_baseline(source, reference, compiled)
            self.assertEqual(result['mode'], 'compiler-byte-identical')
            self.assertFalse(result['originalManifestRecovered'])
            self.assertEqual(set(result['outputs']), {'common', 'base', 'expansion'})

    def test_other_source_receipt_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, compiled, reference, proof = self.fixture(Path(tmp))
            proof['sourceStage'] = reference['sourceStage']
            (compiled / 'compiler-proof.json').write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError, 'another source'):
                verify_creator_baseline(source, reference, compiled)

    def test_source_edit_after_compilation_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, compiled, reference, _ = self.fixture(Path(tmp))
            (source / 'sources/Any/Merged.gpl').write_bytes(b'// changed source\n')
            with self.assertRaisesRegex(ValueError, 'source differs'):
                verify_creator_baseline(source, reference, compiled)

    def test_bytecode_edit_is_refused_even_with_a_positive_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, compiled, reference, _ = self.fixture(Path(tmp))
            (compiled / 'expansion.bcd').write_bytes(b'different bytecode')
            with self.assertRaisesRegex(ValueError, 'bytecode changed'):
                verify_creator_baseline(source, reference, compiled)

    def test_a_partial_compiler_proof_is_not_equivalent(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, compiled, reference, proof = self.fixture(Path(tmp))
            del proof['outputs']['base']
            (compiled / 'compiler-proof.json').write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError, 'incomplete'):
                verify_creator_baseline(source, reference, compiled)
