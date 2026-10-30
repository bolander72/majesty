"""Native Domain upgrade descriptors; preserve stock actors and existing identities."""
from dataclasses import replace
import struct
from .community_more_heroes_retirement import chunk
from .legacy_description_wire import unit_parts, unpack_chunk
from majesty_cam.strt import parse_strt

LEVELS = {1: (1500,600,3,275,40), 2: (2000,900,4,300,50),
          3: (3000,1200,5,325,60)}


def upgrade_catalog(archive):
    entries=[e for s in archive.sections if s.extension==b'DUNT' for e in s.entries]
    indexed={e.name[:4]:e for e in entries}
    if b'AB22' in indexed or b'AB23' in indexed:
        raise ValueError('Domain upgrade identities already occupied')
    original=indexed[b'AB21']
    parts=unit_parts(original.data)
    _,hv,hc,h=unpack_chunk(parts[0],b'HEAD')
    _,pv,pc,p=unpack_chunk(parts[1],b'PRIM')
    _,sv,sc,game=unpack_chunk(parts[2],b'SECD')
    if h[:4]!=b'AB21' or p[16:20]!=b'NDG1' or game[:4]!=b'CGDP' or sv!=5:
        raise ValueError('Require the authored private Domain descriptor')
    descriptions={}
    for level,(cost,hp,members,sight,income) in LEVELS.items():
        key=f'AB2{level}'.encode();head=bytearray(h)
        if level>1:
            head=key+h[4:8]+f'dark_paladin_domain{level}'.encode()+b'\0'
            # HEAD carries two NUL-terminated strings after its fixed prefix.
            display=h[8:].split(b'\0',1)[1]
            head+=display
        engine=bytearray(p);engine[16:20]=f'NDG{level}'.encode()
        sec=bytearray(game)
        for offset,value in [(4,cost),(24,income),(28,hp),(32,members),(36,sight)]:
            struct.pack_into('<I',sec,offset,value)
        sec[8:12]=f'AB2{level+1}'.encode() if level<3 else bytes(4)
        sec[12:16]=f'AB2{level-1}'.encode() if level>1 else bytes(4)
        flags=struct.unpack_from('<I',sec,40)[0]
        struct.pack_into('<I',sec,40,flags|1 if level>1 else flags&~1)
        data=chunk(b'DUNT',0,1,chunk(b'DATA',0,3,
             chunk(b'HEAD',hv,hc,head)+chunk(b'PRIM',pv,pc,engine)+chunk(b'SECD',sv,sc,sec)))
        descriptions[key]=replace(original,name=key+original.name[4:],data=data)
    return replace(archive,sections=tuple(
        replace(s,entries=tuple(descriptions.get(e.name[:4],e)for e in s.entries)+
                (descriptions[b'AB22'],descriptions[b'AB23'])) if s.extension==b'DUNT'else s
        for s in archive.sections))


def upgrade_names(archive):
    sections=[]
    for s in archive.sections:
        entries=[]
        for e in s.entries:
            if s.extension==b'STRT' and e.name[:4]==b'UNTN':
                table=parse_strt(e.data)
                if any(r.string_id in [int.from_bytes(k,'little')for k in [b'AB22',b'AB23']]for r in table.records):
                    raise ValueError('Domain upgrade display identities collide')
                old=next(r for r in table.records if r.string_id==int.from_bytes(b'AB21','little'))
                added=tuple(replace(old,string_id=int.from_bytes(k,'little'))for k in [b'AB22',b'AB23'])
                e=replace(e,data=replace(table,records=(*table.records,*added)).to_bytes())
            entries.append(e)
        sections.append(replace(s,entries=tuple(entries)))
    return replace(archive,sections=tuple(sections))
