#!/usr/bin/env python3
"""Pin the bridge's twelve allocator return PCs to the original executable."""
import hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def sha(name):return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
def main():
    output=ROOT/'output/native-order-allocation-sites-audit.json';output.unlink(missing_ok=True)
    export='output/native-order-allocation-sites.json';data=json.loads((ROOT/export).read_text())
    assert (ROOT/export).stat().st_size<=16*1024
    for name,digest in data['sourceSha256'].items():assert sha(name)==digest
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    expected={0x5e4c71:('head',None,12),0x5da543:('order',1,88),0x5da579:('order',2,92),
      0x5da5e5:('order',4,100),0x5da61b:('order',5,92),0x5da651:('order',6,92),
      0x5da687:('order',7,72),0x5da6f3:('order',10,76),0x5da729:('order',11,112),
      0x5e0e39:('path',4,None),0x5e2b61:('path',7,80),0x5e4dc9:('node',None,12)}
    assert len(data['sites'])==12 and len({s['callerPc'] for s in data['sites']})==12
    sites=[]
    for s in data['sites']:
        pc=s['callerPc'];assert (s['role'],s['kind'],s['bytes'])==expected[pc]
        code=pe.get_data(pc-5-base,5);ins=list(md.disasm(code,pc-5))
        assert len(ins)==1 and ins[0].size==5 and ins[0].mnemonic=='call' and ins[0].op_str=='0x64c616'
        if s['role']=='order':
            push=list(md.disasm(pe.get_data(pc-7-base,2),pc-7))
            assert len(push)==1 and push[0].mnemonic=='push' and int(push[0].op_str,0)==s['bytes']
        sites.append(dict(**s,callInstruction=f'{pc-5:08x}',allocatorTarget='0064c616'))
    # Native hook_return uses arg_bytes zero for cdecl; only static provenance
    # is claimed here, not execution of the live hook dispatcher.
    hook='upstream/majesty-recomp/kit/mods/hooks.cpp';text=(ROOT/hook).read_text()
    assert 'c->eip = rd32(c->r[R_ESP]);' in text and 'c->r[R_ESP] += 4u + arg_bytes;' in text
    sources={**data['sourceSha256'],hook:sha(hook),'scripts/audit-native-order-allocation-sites.py':sha('scripts/audit-native-order-allocation-sites.py')}
    report=dict(qualified=True,scope='pinned native allocator return sites and static cdecl hook-return contract',
      executableSha256=PIN,sites=sites,sourceSha256=sources,dependencyEvidenceSha256={export:sha(export)},
      nativeHookRegistered=False,nativeHookReturnExecuted=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(dict(qualified=True,sites=12,nativeHookRegistered=False)))
if __name__=='__main__':main()
