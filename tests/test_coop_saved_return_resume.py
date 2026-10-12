"""Second completion waits for real recipient loading; no game launch."""
import asyncio
import hashlib
import struct
from types import SimpleNamespace

import pytest

from scripts.lib.native_coop_saved_return_resume import CapturedSavedReturnResume
from tests.test_coop_completion_replay import relay


@pytest.mark.parametrize('case',['exact-five','longer-stream','short-stream','wrong-frame','changed-prefix'])
def test_saved_home_selects_first_five_actual_packets_after_resume(tmp_path,monkeypatch,case):
    import json
    from scripts.lib import native_coop_saved_return_resume as module
    owned=tmp_path/'output';owned.mkdir()
    monkeypatch.setattr(module,'ROOT',tmp_path)
    data={}
    def row(name,wire,**fields):
        path=str(owned/name);data[path]=wire
        return dict(copy=path,bytes=len(wire),sha256=hashlib.sha256(wire).hexdigest(),**fields)
    descriptor=b'unchanged saved-home descriptor';descriptor_sha=hashlib.sha256(descriptor).hexdigest()
    requests=[row(f'vote-{action}',relay.put(0x31525044,1,12,40+action,0,action,2,len(descriptor))+descriptor,
                  sender=1,host=True,op=12,action=action,request=40+action)for action in (1,2,3)]
    resume=row('resume',relay.put(256,4)+bytes(x^49 for x in relay.put(48,1,0,0,1,24,9,1,1,0,50,0,0)),sender=1,recipient=2)
    packets=[row(f'input-{i}',relay.put(256,5)+bytes(x^49 for x in relay.put(10+i*2,0,50)),sender=1,recipient=2)for i in range(5)]
    if case=='short-stream':packets.pop()
    if case=='wrong-frame':
        r=packets[2];wire=relay.put(256,5)+bytes(x^49 for x in relay.put(20,0,50));data[r['copy']]=wire;r['sha256']=hashlib.sha256(wire).hexdigest()
    if case=='changed-prefix':data[packets[1]['copy']]=b'changed actual packet'
    if case=='longer-stream':
        # The later stream is neither selected nor transmitted by this fixture.
        packets.append(dict(copy='outside selected prefix',bytes=16,sha256='unused',sender=1,recipient=2))
    report_name=str(owned/'report.json');report=dict(nativeExecutableSha256='current-executable',lobbyPacketMetadata=[resume,*packets])
    report_raw=json.dumps(report).encode();data[report_name]=report_raw
    proof=dict(descriptorSha256=descriptor_sha,browserUsed=False,sourceFrame=31,sourceClock=1550,originalClock=550,
               report=report_name,reportSha256=hashlib.sha256(report_raw).hexdigest(),capturedHostSecondRequests=requests,
               capturedSecondResume=resume,verifierInputs={})
    for key in ('originalHostSavedReaderLoadedQualified','originalHostSavedHomeGameplayPreservedQualified',
                'originalPausedSourceGameplayPreservedQualified','actualSecondCompleteQualified','originalHostSecondResumeExecutedQualified'):
        proof[key]=True
    proof_name=owned/'proof.json';data[str(proof_name)]=json.dumps(proof).encode()
    def read(name,cap):
        b=data[str(name)];assert len(b)<=cap;return b
    monkeypatch.setattr(module,'bounded_read',read)
    checked={k:proof[k]for k in ('reportSha256','descriptorSha256','capturedHostSecondRequests','capturedSecondResume','verifierInputs')}
    monkeypatch.setattr(module.subprocess,'run',lambda *a,**k:SimpleNamespace(returncode=0,stdout=json.dumps(checked)))
    if case in ('short-stream','wrong-frame','changed-prefix'):
        with pytest.raises(ValueError):CapturedSavedReturnResume(proof_name,descriptor_sha,'current-executable',home_inputs=True)
    else:
        p=CapturedSavedReturnResume(proof_name,descriptor_sha,'current-executable',home_inputs=True)
        assert p.resume_payloads==[data[resume['copy']],*[data[r['copy']]for r in packets[:5]]]
        assert len(p.source_inputs)==11

MARKER = ('[coop-return-fixture] Snapshot epoch=1 serial=2 local=2 slot=1 region=0_0 '
          'frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 '
          'peer-loaded=0 resume-controls=0 live-second-engine=0\n')


@pytest.mark.parametrize('case', ['valid', 'transfer-incomplete', 'no-ready', 'no-commit',
                                  'no-loaded', 'no-writer', 'wrong-descriptor', 'duplicate', 'unknown-outcome'])
def test_second_loaded_requires_original_reader_writer_and_votes(tmp_path, monkeypatch, case):
    descriptor = b'actual saved return descriptor'
    wire = struct.pack('<8I', 0x31525044, 1, 12, 93, 0, 3, 2, len(descriptor)) + descriptor
    path = tmp_path / 'actual-recipient-loaded.bin'
    path.write_bytes(wire)
    profile = tmp_path / 'owned-profile'
    target = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'
    target.parent.mkdir(parents=True)
    target.write_bytes(b'original held home')
    (tmp_path / 'native.log').write_text(MARKER if case != 'no-writer' else 'not saved\n')
    def owned(name, cap):
        p = path if str(name) == str(path) else tmp_path / 'native.log'
        data = p.read_bytes()
        assert len(data) <= cap
        return data
    monkeypatch.setattr('scripts.lib.native_coop_saved_return_resume.bounded_read', owned)
    row = dict(sender=2, host=False, op=12, action=3, copy=str(path), bytes=len(wire),
               sha256=hashlib.sha256(wire).hexdigest())
    p = CapturedSavedReturnResume.__new__(CapturedSavedReturnResume)
    p.sent_loaded = p.sent_resume = False
    p.descriptor_sha = hashlib.sha256(descriptor if case != 'wrong-descriptor' else b'other').hexdigest()
    p.loaded_body = b'captured original second host Loaded'
    p.loaded_row = dict(copy='owned actual host Loaded')
    parent = SimpleNamespace(sent_return_ready=case != 'no-ready',
                             transfer=SimpleNamespace(completed=case != 'transfer-incomplete'))
    report = dict(profile=str(profile), observedSavedReturnEvents=[dict(stage=1), dict(stage=2)],
                  proposalProtocolRequests=[] if case == 'no-loaded' else [row, row] if case == 'duplicate' else [row])
    if case == 'no-commit':
        report['observedSavedReturnEvents'].pop()
    calls = []
    async def rpc(*args):
        calls.append(args)
        if case == 'unknown-outcome':
            raise TimeoutError()
        return b''
    if case in ('wrong-descriptor', 'duplicate', 'unknown-outcome'):
        with pytest.raises(TimeoutError if case == 'unknown-outcome' else ValueError):
            asyncio.run(p.send_pending(relay, rpc, report, parent))
        if case == 'unknown-outcome':
            asyncio.run(p.send_pending(relay, rpc, report, parent))
            assert len(calls) == 1
        else:
            assert not calls
    else:
        asyncio.run(p.send_pending(relay, rpc, report, parent))
        asyncio.run(p.send_pending(relay, rpc, report, parent))
        assert calls == ([(12, p.loaded_body)] if case == 'valid' else [])


def test_original_second_resume_requires_real_complete_and_is_sent_once():
    p = CapturedSavedReturnResume.__new__(CapturedSavedReturnResume)
    p.sent_loaded = p.sent_resume = False
    p.resume = b'unchanged actual original resume'
    report = dict(observedSavedReturnEvents=[dict(stage=1), dict(stage=2)])
    assert p.resume_packets(report) == []
    p.sent_loaded = True
    assert p.resume_packets(report) == []
    report['observedSavedReturnEvents'].append(dict(stage=3))
    assert p.resume_packets(report) == [p.resume]
    assert p.resume_packets(report) == []

def test_actual_extended_home_stream_waits_for_real_second_complete():
    p=CapturedSavedReturnResume.__new__(CapturedSavedReturnResume)
    p.sent_loaded=True;p.sent_resume=False;p.resume=b'actual resume'
    p.resume_payloads=[p.resume]+[b'actual host input'+bytes([i]) for i in range(5)]
    report=dict(observedSavedReturnEvents=[dict(stage=1),dict(stage=2)])
    assert p.resume_packets(report)==[]
    report['observedSavedReturnEvents'].append(dict(stage=3))
    assert p.resume_packets(report)==p.resume_payloads
    assert p.resume_packets(report)==[]
