"""Preflight rejection controls; no CPU instance or game is created."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('order_readers',ROOT/'scripts/check-native-order-readers.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)


def fixture(kind=7):
    lengths={4:35,7:28,13:47};words=[0]*lengths[kind]
    if kind==13:words[:5]=[1,1,1,2,13]
    else:words[:4]=[5 if kind==4 else 1,1,2,kind]
    if kind==4:words[32]=10
    case=dict(kind=kind,count=0,words=words,filename='fixture.GMP',snapshotSha256='f'*64,
              sourceOffset=400,payloadBytes=len(words)*4,normalizations=[],poison=0x5a)
    case['payloadSha256']=hashlib.sha256(struct.pack('<'+'I'*len(words),*words)).hexdigest()
    return dict(qualified=True,literalPayloadsMatched=True,cases=[case],reports=[dict(filename='fixture.GMP',
        sha256='f'*64,fileBytes=1000,entries=1,fileIdentityUnchanged=True,previousFixtureHashMatched=True)])


def rehash(case):
    case['payloadSha256']=hashlib.sha256(struct.pack('<'+'I'*len(case['words']),*case['words'])).hexdigest()


class CapturedOrderControls(unittest.TestCase):
    def test_actual_capture_and_small_boundary_fixture_pass_schema_checks(self):
        capture=json.loads((ROOT/'output/native-order-reader-cases.json').read_text())
        self.assertEqual(len(reader.validate_captured_cases(capture)),154)
        for kind in [4,7,13]:self.assertEqual(len(reader.validate_captured_cases(fixture(kind))),1)

    def test_inherited_version_and_two_distinct_stack_poison_cases_remain_checked(self):
        capture=fixture(13);second=copy.deepcopy(capture['cases'][0]);second['poison']=0xc3
        capture['cases'].append(second);capture['reports'][0]['entries']=2
        self.assertEqual(len(reader.validate_captured_cases(capture)),2)
        bad=copy.deepcopy(capture);bad['cases'][1]['poison']=0x5a
        with self.assertRaisesRegex(ValueError,'Duplicate'):reader.validate_captured_cases(bad)
        bad=fixture(13);bad['cases'][0]['words'][1]=2;rehash(bad['cases'][0])
        with self.assertRaisesRegex(ValueError,'version'):reader.validate_captured_cases(bad)

    def test_literal_digest_and_version_changes_are_independent_rejections(self):
        bad=fixture();bad['cases'][0]['words'][4]=17
        with self.assertRaisesRegex(ValueError,'digest'):reader.validate_captured_cases(bad)
        bad=fixture();bad['cases'][0]['words'][0]=2;rehash(bad['cases'][0])
        with self.assertRaisesRegex(ValueError,'version'):reader.validate_captured_cases(bad)
        bad=fixture();bad['cases'][0]['normalizations']=[dict(word=4,before=0,after=17)]
        with self.assertRaisesRegex(ValueError,'normalization'):reader.validate_captured_cases(bad)

    def test_unbounded_or_inconsistent_path_storage_rejects_before_execution(self):
        for capacity in [11,0xffffffff,0x20000000]:
            bad=fixture(4);bad['cases'][0]['words'][32]=capacity;rehash(bad['cases'][0])
            with self.assertRaisesRegex(ValueError,'capacity'):reader.validate_captured_cases(bad)
        bad=fixture(7);case=bad['cases'][0];case['count']=11;case['words'][27]=11
        case['words'].extend([0]*22);case['payloadBytes']=len(case['words'])*4;rehash(case)
        with self.assertRaisesRegex(ValueError,'count'):reader.validate_captured_cases(bad)
        bad=fixture(7);bad['cases'][0]['words'][27]=1;rehash(bad['cases'][0])
        with self.assertRaisesRegex(ValueError,'count mismatch'):reader.validate_captured_cases(bad)

    def test_case_budget_duplicates_and_file_ranges_reject_before_execution(self):
        bad=fixture();bad['cases']=[copy.deepcopy(bad['cases'][0]) for _ in range(257)]
        with self.assertRaisesRegex(ValueError,'budget'):reader.validate_captured_cases(bad)
        bad=fixture();bad['cases'].append(copy.deepcopy(bad['cases'][0]));bad['reports'][0]['entries']=2
        with self.assertRaisesRegex(ValueError,'Duplicate'):reader.validate_captured_cases(bad)
        bad=fixture();bad['cases'][0]['sourceOffset']=999
        with self.assertRaisesRegex(ValueError,'file range'):reader.validate_captured_cases(bad)
        bad=fixture();bad['reports'][0]['fileIdentityUnchanged']=False
        with self.assertRaisesRegex(ValueError,'changed'):reader.validate_captured_cases(bad)


if __name__=='__main__':unittest.main()
