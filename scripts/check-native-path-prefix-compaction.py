#!/usr/bin/env python3
"""Execute the pinned Path current/next reads before/after consumed-prefix removal."""
import hashlib,json,struct
from pathlib import Path
import capstone,pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE,UC_HOOK_MEM_READ,UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_ESI,UC_X86_REG_ESP,UC_X86_REG_EDX,UC_X86_REG_EAX

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
out=ROOT/'output/native-path-prefix-compaction-001-observed.json'
if out.exists():raise ValueError('Preserve existing evidence')
exe=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
raw=exe.read_bytes();assert hashlib.sha256(raw).hexdigest()==PIN
pe=pefile.PE(data=raw);start,end,miss=0x5e14d4,0x5e1505,0x5e179e
native=pe.get_data(start-pe.OPTIONAL_HEADER.ImageBase,end-start)
instructions=list(capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(native,start))
assert sum(i.size for i in instructions)==len(native)
rows={i.address:(i.mnemonic,i.op_str)for i in instructions}
for at,pair in {0x5e14d4:('mov','eax, dword ptr [esi + 0x48]'),
 0x5e14da:('mov','edx, dword ptr [ecx + eax*8]'),
 0x5e14dd:('mov','ebp, dword ptr [ecx + eax*8 + 4]'),
 0x5e14f5:('mov','edx, dword ptr [ecx + eax*8 + 8]'),
 0x5e1501:('mov','eax, dword ptr [ecx + eax*8 + 0xc]')}.items():assert rows[at]==pair
observations=[]
for poison in [0x5a,0xc3]:
 for removed,cursor,count in [(1,4,7),(3,4,7),(4,4,7),(1,1,3)]:
  # Past coordinates deliberately sit outside the active map. Both forms
  # must produce identical current/next pairs without ever reading that past.
  points=[(7,260-i)for i in range(count)]
  for matches in [True,False]:
   results=[]
   for compacted in [False,True]:
    data,stack=0x100000,0x200000;path=data+256;cpu=Uc(UC_ARCH_X86,UC_MODE_32)
    pages=[data,stack,start&~4095];hooks=[];steps=0;reads=[];reached=None
    try:
     for page in pages:cpu.mem_map(page,4096)
     cpu.mem_write(start,native);cpu.mem_write(data,bytes([poison])*4096);cpu.mem_write(stack,bytes([poison])*4096)
     values=points[removed:]if compacted else points;index=cursor-removed if compacted else cursor
     cpu.mem_write(path,b''.join(struct.pack('<2i',*p)for p in values))
     cpu.mem_write(data+0x44,struct.pack('<3I',path,index,len(values)))
     before=bytes(cpu.mem_read(data,4096));sp=stack+2048
     cpu.mem_write(sp+0x2c,struct.pack('<2i',points[cursor][0]+(0 if matches else 1),points[cursor][1]))
     cpu.reg_write(UC_X86_REG_ESI,data);cpu.reg_write(UC_X86_REG_ESP,sp)
     def code(uc,at,size,context):
      global steps,reached
      if at in [end,miss]:reached=at;uc.emu_stop();return
      assert at in rows;steps+=1;assert steps<=16
     def read(uc,access,at,size,value,context):
      if path<=at<path+len(values)*8:
       assert path+index*8<=at and at+size<=path+(index+2)*8;reads.append(at-path)
      else:assert (data+0x44<=at and at+size<=data+0x4c)or(stack<=at and at+size<=stack+4096),(hex(at),size)
     def write(uc,access,at,size,value,context):assert sp+0x1c<=at and at+size<=sp+0x20
     hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
     cpu.emu_start(start,0,timeout=100000,count=20)
     assert reached==(end if matches else miss);assert bytes(cpu.mem_read(data,4096))==before
     result=[cpu.reg_read(UC_X86_REG_EDX),cpu.reg_read(UC_X86_REG_EAX)]if matches else None
     if matches:assert result==list(points[cursor+1])
     results.append(result);observations.append(dict(poison=poison,removed=removed,cursor=cursor,count=count,
      compacted=compacted,matches=matches,pointReads=len(reads),pastPointReads=0,originalInstructions=steps,result=result))
    finally:
     for hook in hooks:cpu.hook_del(hook)
     for page in pages:cpu.mem_unmap(page,4096)
     assert list(cpu.mem_regions())==[]
   assert results[0]==results[1]
assert hashlib.sha256(exe.read_bytes()).hexdigest()==PIN
report=dict(qualified=True,scope='original Path current/next selection only',executableSha256=PIN,
 originalRangeSha256=hashlib.sha256(native).hexdigest(),observations=observations,
 sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),pastPointReads=0,
 mappedGuestBytesPeak=12288,mappedGuestBytesAfterCleanup=0,gameLaunched=False,browserUsed=False,
 fullNativeArrivalQualified=False,goalComplete=False)
out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(dict(qualified=True,calls=len(observations),pastPointReads=0)))
