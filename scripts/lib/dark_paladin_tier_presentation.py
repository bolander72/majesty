"""Native tier labels and additive upgrade art; no unit stats or scripts change."""
from dataclasses import replace
import struct
from majesty_cam.art import parse_best_imag_tile_references
from majesty_cam.strt import parse_strt
from .legacy_description_wire import unit_parts,unpack_chunk
from .community_more_heroes_retirement import chunk


LEVEL_NAMES={b'AB21':b"Dark Paladin's Domain",b'AB22':b'Dark Paladin Level 2',b'AB23':b'Dark Paladin Level 3'}


def label_levels(archive):
    found=set();sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            if section.extension==b'STRT'and entry.name[:4]==b'UNTN':
                table=parse_strt(entry.data);records=[]
                for r in table.records:
                    key=r.string_id.to_bytes(4,'little')
                    if key in LEVEL_NAMES:
                        found.add(key);r=replace(r,text=LEVEL_NAMES[key])
                    records.append(r)
                entry=replace(entry,data=replace(table,records=tuple(records)).to_bytes())
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    if found!=set(LEVEL_NAMES):raise ValueError('Require all three Domain tier labels')
    return replace(archive,sections=tuple(sections))


def label_descriptions(archive):
    found=set();sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            key=entry.name[:4]
            if section.extension==b'DUNT'and key in LEVEL_NAMES:
                parts=unit_parts(entry.data);_,version,count,head=unpack_chunk(parts[0],b'HEAD')
                internal,description=head[8:].split(b'\0',1)
                if not description.endswith(b'\0'):raise ValueError('Incomplete native description')
                parts[0]=chunk(b'HEAD',version,count,head[:8]+internal+b'\0'+LEVEL_NAMES[key]+b'\0')
                entry=replace(entry,data=chunk(b'DUNT',0,1,chunk(b'DATA',0,len(parts),b''.join(parts))))
                found.add(key)
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    if found!=set(LEVEL_NAMES):raise ValueError('Require all three native building descriptions')
    return replace(archive,sections=tuple(sections))


def additive_upgrades(archive):
    tiles=next(s for s in archive.sections if s.extension==b'TILE')
    images={e.name[:4]:e for s in archive.sections if s.extension==b'IMAG'for e in s.entries}
    refs={k:parse_best_imag_tile_references(images[k].data,tile_count=len(tiles.entries),entry_name=k).references
          for k in [b'NDG1',b'NDG2',b'NDG3']}
    completed={k:next(r.tile_index for r in rs if r.set_id==96)for k,rs in refs.items()}
    sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            key=entry.name[:4]
            if section.extension==b'IMAG'and key in [b'NDG2',b'NDG3']:
                body=bytearray(entry.data);changed=[]
                previous=b'NDG1'if key==b'NDG2'else b'NDG2'
                for r in refs[key]:
                    if r.set_id in [80,81,82]:
                        # Preserve the entire prior tier while work starts;
                        # reveal the enlarged target building in the late stage.
                        tile=completed[previous]if r.set_id in [80,81]else completed[key]
                        struct.pack_into('<I',body,r.offset,r.flag_bits|tile);changed.append(r.set_id)
                if set(changed)!={80,81,82}:raise ValueError('Missing native construction stages')
                entry=replace(entry,data=bytes(body))
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    return replace(archive,sections=tuple(sections))
