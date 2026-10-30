#!/usr/bin/env python3
"""Stage only the approved Dark Paladin admission with independent native art."""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
from lib.community_expansion_media import append_art
from lib.community_more_heroes_retirement import chunk, BUILDING_KEYS, HERO_KEYS
from lib.legacy_description_wire import unit_parts,unpack_chunk
from lib.dark_paladin_interface import PANEL, panel_resources, append_panel
from lib.dark_paladin_upgrades import upgrade_catalog, upgrade_names
from lib.community_native_tables import merge_strings
from majesty_cam.strt import parse_strt


def digest(raw):
    return dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())


def selected_strings(archive, source, table_keys):
    tables={e.name[:4]:parse_strt(e.data) for s in source.sections if s.extension==b'STRT'
            for e in s.entries if e.name[:4] in table_keys}
    changed=set()
    sections=[]
    for section in archive.sections:
        entries=[]
        for entry in section.entries:
            key=entry.name[:4]
            if section.extension==b'STRT' and key in table_keys:
                ids={int.from_bytes(x,'little')for x in table_keys[key]}
                overlay=replace(tables[key],records=tuple(r for r in tables[key].records if r.string_id in ids))
                if {r.string_id for r in overlay.records}!=ids:raise ValueError('Missing original display/help records')
                entry=replace(entry,data=merge_strings(parse_strt(entry.data),overlay).to_bytes())
                changed.add(key)
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    if changed!=table_keys.keys():raise ValueError('Missing destination native string table')
    return replace(archive,sections=tuple(sections))


def stage_units(retired,original):
    before={e.name[:4]:e for s in original.sections if s.extension==b'DUNT' for e in s.entries}
    keys=[e.name[:4].decode() for s in retired.sections if s.extension==b'DUNT' for e in s.entries]
    if len(keys)!=len(set(keys)) or not BUILDING_KEYS|HERO_KEYS <= set(keys):
        raise ValueError('Require complete, unique preserved More Heroes actor definitions')
    changed=[]
    sections=[]
    for section in retired.sections:
        entries=[]
        for entry in section.entries:
            key=entry.name[:4]
            if section.extension==b'DUNT' and key in [b'AV21',b'AB21']:
                parts=unit_parts(entry.data)
                _,v,c,payload=unpack_chunk(parts[1],b'PRIM')
                if payload[16:20] != {b'AV21':b'AVF1',b'AB21':b'BBB3'}[key]:
                    raise ValueError('Unexpected stock image binding')
                body=bytearray(payload)
                body[16:20]={b'AV21':b'NDH1',b'AB21':b'NDG1'}[key]
                if key==b'AV21':
                    if body[-12:-8]!=b'PN01':raise ValueError('Original Paladin voice binding differs')
                    body[-12:-8]=b'WR01'
                parts[1]=chunk(b'PRIM',v,c,body)
                if key==b'AB21':
                    parts[2]=unit_parts(before[key].data)[2]
                    _,v,c,p=unpack_chunk(parts[2],b'SECD')
                    if v!=5 or c or struct.unpack_from('<I',p,40)[0]&1 or p[72:]!=b'AV21':
                        raise ValueError('Require original single Dark Paladin production')
                    body=bytearray(p)
                    if body[:4]!=b'AP06':raise ValueError('Original single-choice controller differs')
                    body[:4]=PANEL
                    parts[2]=chunk(b'SECD',v,c,body)
                raw=chunk(b'DUNT',0,1,chunk(b'DATA',0,len(parts),b''.join(parts)))
                entry=replace(entry,data=raw)
                changed.append(key.decode())
            if section.extension==b'DUNT':
                parts=unit_parts(entry.data)
                if len(parts)==3:
                    _,v,c,p=unpack_chunk(parts[2],b'SECD')
                    if v==5:
                        if key.decode() in BUILDING_KEYS-{'AB21'} and not struct.unpack_from('<I',p,40)[0]&1:
                            raise ValueError('Other retired building admitted')
                        admitted={p[i:i+4].decode() for i in range(72,len(p),4)} & HERO_KEYS
                        if admitted and (key!=b'AB21' or admitted!={'AV21'}):
                            raise ValueError('Other retired recruitment admitted')
            entries.append(entry)
        sections.append(replace(section,entries=tuple(entries)))
    if len(changed)!=2 or set(changed)!={'AB21','AV21'}:
        raise ValueError('Require exactly the two approved actor changes')
    return replace(retired,sections=tuple(sections)),changed


def prepare(a):
    if a.out.exists():raise ValueError('Preserve earlier stages')
    old=a.units.read_bytes()
    units,changes=stage_units(read_cam(old),read_cam(a.original_units.read_bytes()))
    base_raw=a.base_units.read_bytes()
    base=read_cam(base_raw)
    native={e.name[:4]:e for s in units.sections if s.extension==b'DUNT' for e in s.entries}
    sections=[]
    for section in base.sections:
        if section.extension==b'DUNT':
            if any(e.name[:4] in [b'AB21',b'AV21'] for e in section.entries):
                raise ValueError('Original campaign already contains the prototype identities')
            if b'MP00' not in native:raise ValueError('Missing original Exploding Aura projectile')
            section=replace(section,entries=(*section.entries,native[b'AB21'],native[b'AV21'],native[b'MP00']))
        sections.append(section)
    base=replace(base,sections=tuple(sections))
    units=upgrade_catalog(units)
    base=upgrade_catalog(base)
    actions_raw=a.base_actions.read_bytes()
    actions=read_cam(actions_raw)
    northern_actions=read_cam(a.northern_actions.read_bytes())
    selected={e.name[:4]:e for s in northern_actions.sections if s.extension==b'DACT'
              for e in s.entries if e.name[:4]in[b'MH02',b'MH03']}
    if set(selected)!={b'MH02',b'MH03'}:raise ValueError('Missing private spell actions')
    sections=[]
    for section in actions.sections:
        if section.extension==b'DACT':
            if any(e.name[:4] in selected for e in section.entries):raise ValueError('Private action collision')
            section=replace(section,entries=(*section.entries,selected[b'MH02'],selected[b'MH03']))
        sections.append(section)
    actions=replace(actions,sections=tuple(sections))
    prior=a.community.read_bytes()
    art=a.art.read_bytes()
    media,proof=append_art(read_cam(prior),read_cam(art),{b'NDH1',b'NDG1',b'NDG2',b'NDG3'})
    files={'Data/unittype.cam':base.to_bytes(),'Data/action.cam':actions.to_bytes(),
           'DataMX/mx_Unittype.cam':units.to_bytes(),
           'Data/Community-main.cam':media.to_bytes(),'DataMX/Community-main.cam':media.to_bytes()}
    panels=panel_resources(read_cam(a.panel_source.read_bytes()))
    text_inputs={}
    for name in ('Data/textdata.cam','Data/Community-textdata.cam',
                 'DataMX/mx_textdata.cam','DataMX/Community-textdata.cam'):
        raw=(a.text_root/name).read_bytes()
        text_inputs[name]=digest(raw)
        archive=append_panel(read_cam(raw),panels)
        if name.startswith('Data/'):
            northern='DataMX/'+('mx_textdata.cam' if name=='Data/textdata.cam' else 'Community-textdata.cam')
            archive=selected_strings(archive,read_cam((a.text_root/northern).read_bytes()),
                                     {b'UNTN':[b'AB21',b'AV21'],b'ACTN':[b'MH02',b'MH03']})
        files[name]=upgrade_names(archive).to_bytes()
    help_inputs={}
    for name,source in [('Data/gpltext.cam','DataMX/mx_gpltext.cam'),
                        ('Data/Community-gpltext.cam','DataMX/Community-gpltext.cam')]:
        raw=(a.text_root/name).read_bytes();help_inputs[name]=digest(raw)
        source_raw=(a.text_root/source).read_bytes();help_inputs[source]=digest(source_raw)
        files[name]=selected_strings(read_cam(raw),read_cam(source_raw),
                                     {b'HPTX':[b'MT10',b'MT11']}).to_bytes()
    prerequisite_inputs={}
    for name in ('Data/miscdata.cam','DataMX/mx_miscdata.cam'):
        raw=(a.text_root/name).read_bytes()
        archive=read_cam(raw)
        prerequisite_inputs[name]=digest(raw)
        count=0
        sections=[]
        for section in archive.sections:
            entries=[]
            for entry in section.entries:
                if section.extension==b'DATA' and entry.name[:4]==b'BDEP':
                    if any(line.split(b':',1)[0].strip()==b'AB21' for line in entry.data.splitlines()):
                        raise ValueError('Private guild prerequisite already occupied')
                    # The source Northern Palace script admits this guild at
                    # level two. Express that same requirement in the native
                    # prerequisite table for both campaign editions.
                    entry=replace(entry,data=entry.data.rstrip(b'\r\n')+b'\r\nAB21 : ABJ2 ABJ3 ||\r\nAB22 : ABJ2 ABJ3 ||\r\nAB23 : ABJ3\r\n\r\n')
                    count+=1
                entries.append(entry)
            sections.append(replace(section,entries=tuple(entries)))
        if count!=1:raise ValueError('Require one native building prerequisite table')
        files[name]=replace(archive,sections=tuple(sections)).to_bytes()
    a.out.mkdir(parents=True)
    for name,raw in files.items():
        p=a.out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    result=dict(format='majesty-dark-paladin-private-prototype-v1',files={n:digest(b)for n,b in files.items()},
                priorUnits=digest(old),priorArt=digest(prior),authoredArt=digest(art),
                changedActors=changes,artImport=proof,otherRetiredAdmissionsDisabled=True,
                originalCampaignCatalog=digest(base_raw),originalCampaignActorsAdded=['AB21','AV21'],
                originalCampaignProjectileAdded='MP00',originalCampaignActionsAdded=['MH02','MH03'],
                originalActionCatalog=digest(actions_raw),
                privateGuildPanel=PANEL.decode(),priorTextArchives=text_inputs,
                stockGuildPanelsUnchanged=True,
                priorHelpArchives=help_inputs,originalCampaignDisplayRecords=['AB21','AV21','MH02','MH03'],
                originalCampaignHelpRecords=['MT10','MT11'],
                priorPrerequisiteArchives=prerequisite_inputs,palaceLevelRequirement=2,
                gameplayScriptsUnchanged=True,randomArrivalsUnchanged=True,engineUnchanged=True,
                privateOnly=True,nativePlayQualified=False,published=False)
    (a.out/'prototype-stage.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['units','base-units','base-actions','northern-actions','original-units','community','art',
              'panel-source','text-root','out']:p.add_argument('--'+n,type=Path,required=True)
    prepare(p.parse_args())
