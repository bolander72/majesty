"""Native tier labels and additive upgrade art; no unit stats or scripts change."""
from dataclasses import replace
import struct
from majesty_cam.art import parse_best_imag_tile_references
from majesty_cam.strt import parse_strt
from .legacy_description_wire import unit_parts,unpack_chunk
from .community_more_heroes_retirement import chunk


LEVEL_NAMES={b'AB21':b"Dark Paladin's Guild",b'AB22':b"Dark Paladin's Guild Level 2",b'AB23':b"Dark Paladin's Guild Level 3"}


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



def label_panels(archive):
    sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            if section.extension==b'STRT'and entry.name[:4]in [b'CGDP',b'HLP1']:
                table=parse_strt(entry.data);records=[]
                for r in table.records:
                    text=r.text
                    if entry.name[:4]==b'CGDP':
                        if r.string_id==0:text=b"DARK PALADIN'S GUILD"
                        elif r.string_id==3:text=b"Destroy this Dark Paladin's Guild."
                    elif r.string_id.to_bytes(4,'little')in LEVEL_NAMES:
                        text=text.replace(b"Dark Paladin's Domain",b"Dark Paladin's Guild").replace(b'Dark Paladin Domain',b"Dark Paladin's Guild")
                    records.append(replace(r,text=text))
                entry=replace(entry,data=replace(table,records=tuple(records)).to_bytes())
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    return replace(archive,sections=tuple(sections))
