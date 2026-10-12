#!/usr/bin/env python3
"""Pin an inspected guest's original empty-input window before serial replay."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile
from lib.native_original_guest_replay import GuestTranscript
from lib.native_original_host_replay import PIN, ROOT


def audit(path):
    proof=json.loads(path.read_text());r=json.loads(Path(proof['report']).read_text())
    # The producer records the manifest digest; reconstruct its reviewed rules
    # rather than accepting an arbitrary new manifest or changing its epoch.
    from lib.native_original_host_replay import lobby_manifest
    wire=lobby_manifest(r['nativeExecutableSha256'],r['configuredCoopChapter'],
        r['configuredCoopRegion'],r['nativeFixtureContentIdentity'])
    assert hashlib.sha256(wire).hexdigest()==r['networkManifestSha256']
    transcript=GuestTranscript(path,wire,r['nativeExecutableSha256'],
        r['configuredCoopChapter'],r['configuredCoopRegion'],r['nativeFixtureContentIdentity'])
    window=transcript.input_window()
    original=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw=original.read_bytes();assert hashlib.sha256(raw).hexdigest()==PIN
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    anchors=[
        (0x00417894,'call','dword ptr [edx + 0x10]'),
        (0x0049e238,'call','0x5a4250'),
        (0x004179a2,'mov','ecx, edi'),
        (0x004179a4,'call','0x415dd0'),
        (0x0049b9a8,'push','5'),(0x0049b9ac,'call','0x588300'),
        (0x0049be46,'xor','esi, esi'),(0x0049be48,'push','0xc'),
        (0x0049be53,'mov','dword ptr [eax + 4], esi'),
        (0x0049be56,'mov','dword ptr [eax], edx'),
        (0x0049be58,'mov','ecx, dword ptr [edi + 0x278]'),
        (0x0049be5e,'mov','edx, dword ptr [edi + 0x88]'),
        (0x0049be71,'mov','dword ptr [eax + 8], ecx'),
        (0x0049be80,'mov','dword ptr [edx], 0xc'),
        (0x00498e5d,'call','0x49c100'),
        (0x0049c132,'mov','ecx, dword ptr [edi + 8]'),
        (0x0049c137,'mov','eax, dword ptr [edi]'),
        (0x0049c1e0,'mov','dword ptr [esi + 0x14], ebp'),
        (0x0049c1e3,'mov','dword ptr [esi + 0x18], 0')]
    rows=[]
    for address,mnemonic,operands in anchors:
        i=next(md.disasm(pe.get_data(address-base,15),address))
        assert (i.mnemonic,i.op_str)==(mnemonic,operands),hex(address)
        rows.append(dict(address=f'{address:08x}',mnemonic=mnemonic,operands=operands))
    assert struct.unpack('<I',pe.get_data(0x00682bc4+0x54-base,4))[0]==0x0049b840
    assert struct.unpack('<I',pe.get_data(0x00682bc4+0x10-base,4))[0]==0x0049e230
    return dict(version=1,originalEmptyInputWindowAbiQualified=True,
        originalExecutableSha256=PIN,sourceProof=str(path),sourceProofSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        nativeExecutableSha256=r['nativeExecutableSha256'],originalInstructionAnchors=rows,
        frames=list(range(10,20,2)),commandCountPerPacket=0,originalTimingSample=50,
        preparedInputReturn='004179a9',originalQueuePreparation='005a4250',
        originalPacketBytes=[len(p) for p in window.payloads],
        originalPacketSha256=[hashlib.sha256(p).hexdigest() for p in window.payloads],
        browserUsed=False,gameProcessesStarted=0,liveSecondOriginalEngine=False,
        sharedSaveLoadResumeQualified=False,
        scope='Pinned empty bundle builder/receiver and independently inspected original guest bytes only; delivery, actual pause and shared read/resume require separate runtime evidence.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('proof',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
    r=audit(args.proof.resolve())
    with args.output.open('x') as f:json.dump(r,f,indent=2);f.write('\n')
    print(json.dumps(dict(originalEmptyInputWindowAbiQualified=True,packets=5,frames=r['frames'])))
