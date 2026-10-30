"""Match CGDP's AP06 single-choice controller: Heroes, with no spell command."""
from dataclasses import replace
import struct

def single_choice_panel(archive):
    found=0;sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            if section.extension==b'SMNU'and entry.name[:4]==b'CGDP':
                words=list(struct.unpack('<893i',entry.data))
                if (words[756:762]!=[0,2,7,162,93,26]or words[775:777]!=[13,1004]
                    or words[805:811]!=[0,2,103,162,93,26]or words[824:826]!=[13,1009]or words[853]!=-1):
                    raise ValueError('Review the native guild-panel command records')
                # Keep the native Heroes widget and center it exactly as AP06.
                # Delete the complete unsupported command, retaining terminators.
                words[758]=53;words=words[:805]+words[854:]
                entry=replace(entry,data=struct.pack('<'+str(len(words))+'i',*words));found+=1
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    if found!=1:raise ValueError('Require the private CGDP panel only')
    return replace(archive,sections=tuple(sections))
