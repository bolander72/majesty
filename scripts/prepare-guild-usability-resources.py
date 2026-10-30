#!/usr/bin/env python3
"""Stage native guild scale, usable reward menus and player-facing help."""
import argparse,hashlib,json,struct,sys
from pathlib import Path
from dataclasses import replace
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam,CamEntry
from majesty_cam.strt import parse_strt,StrtRecord
from lib.legacy_description_wire import unit_parts,unpack_chunk

def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def records(raw):
 words=list(struct.unpack('<'+str(len(raw)//4)+'i',raw));out=[];at=0
 for i,v in enumerate(words):
  if v==-1:out.append(words[at:i+1]);at=i+1
 assert at==len(words);return out

def prop(row,key,value):
 # These native scalar properties follow the fixed type/rectangle prefix.
 hits=[i for i in range(6,len(row)-1)if row[i]==key]
 assert len(hits)==1,(key,hits);row[hits[0]+1]=value

def panel_id(row):
 # Control-ID property 6, found after the type and geometry fields.
 hits=[row[i+1]for i in range(6,len(row)-1)if row[i]==6]
 return hits[-1]if hits else None

def reward_panel(stock,zoo):
 rows=records(stock);zrows=records(zoo);by={panel_id(r):r for r in rows if len(r)>2}
 capture=by[5003].copy();capture[2]=29;capture[3]=210;capture[5]=35;prop(capture,7,14);prop(capture,33,15);prop(capture,6,5018);capture[next(i for i in range(6,len(capture)-1)if capture[i:i+2]==[5,69])+1]=67
 # Preserve native capture icon artwork and stock button framing.
 icon=next(r.copy()for r in zrows if panel_id(r)==7001);icon[2]=33;icon[3]=214;prop(icon,6,7003)
 result=rows[:-1]+[capture,icon]+rows[-1:]
 return struct.pack('<'+str(sum(map(len,result)))+'i',*(v for r in result for v in r))

def patch_text(archive,palace):
 sections=[]
 updates={b'AP41':{14:'CAPTURE flag',15:'Choose a Capture reward for a living monster. Requires a completed Zoo.'},b'CGZM':{0:'Capture wild beasts, exhibit them, let heroes hire companions, or tame a kingdom guard.',22:'CAPTURE',23:'Set a Capture bounty on an eligible living monster. Heroes will fight to subdue it.',26:'CAPTIVES',27:'View captured beasts. Select one and pay Tame Beast to release a kingdom guard.',28:'RENT ON',29:'Heroes may hire stored beasts as companions using their own gold. Click to stop new rentals.',30:'RENT OFF',31:'New beast rentals are disabled. Click to allow heroes to hire stored beasts.'},b'CGZT':{0:'Select a stored beast, then pay the displayed Tame Beast cost to release it as a kingdom guard.',8:'Pay the displayed cost to release this beast as a permanent guard around your Palace.'},b'CGAG':{25:'View unclaimed quests. Heroes accept suitable jobs automatically; Refresh replaces unclaimed offers.'}}
 have=set()
 for sec in archive.sections:
  entries=[]
  for e in sec.entries:
   key=e.name[:4]
   if sec.extension==b'SMNU'and key==b'AP41':e=replace(e,data=palace)
   if sec.extension==b'SMNU'and key==b'CGAG':
    rows=records(e.data);rows=[r for r in rows if panel_id(r)not in[28944,28945]]
    e=replace(e,data=struct.pack('<'+str(sum(map(len,rows)))+'i',*(v for r in rows for v in r)))
   if sec.extension==b'SMNU'and key==b'CGZM':
    rows=records(e.data)
    for row in rows:
     id=panel_id(row)
     if id==10800:row[2]=100;row[3]=190
     if id in[10801,10802]:row[2]=7;row[3]=217;row[4]=93
    e=replace(e,data=struct.pack('<'+str(sum(map(len,rows)))+'i',*(v for r in rows for v in r)))
   if sec.extension==b'STRT'and key in updates:
    table=parse_strt(e.data);map_={r.string_id:r.text for r in table.records};map_.update({k:v.encode('cp1252')for k,v in updates[key].items()});e=replace(e,data=replace(table,records=tuple(StrtRecord(k,v)for k,v in sorted(map_.items()))).to_bytes())
   entries.append(e);have.add((sec.extension,key))
  sections.append(replace(sec,entries=tuple(entries)))
 return replace(archive,sections=tuple(sections))

ZOO_HELP='''CAPTURE AND STORAGE\nChoose Capture in the Palace Rewards window or this Zoo. Set a gold bounty, then click an eligible living monster. Heroes fight it normally, but subdue it at defeat instead of killing it. The beast is then escorted to a Zoo with room. Capture is reliable when a Zoo has space and a hero can escort the beast. Larger bounties attract more heroes. Summons, allies and some quest bosses cannot be captured.\n\nCAPTIVES / TAME BEAST\nOpen Captives, select a stored beast and pay the displayed Tame Beast cost to release a permanent guard around your Palace. This frees its Zoo slot.\n\nRENTALS ON / OFF\nON lets heroes pay with their own gold to hire a stored beast as a travelling companion. OFF stops new rentals. The label shows the current state; click it to change that state. Capture and manual taming work in either state.\n\nStored beasts generate exhibit income and may escape.'''
AG_HELP='''The Adventurers Guild stays open once built. Heroes choose suitable quests automatically, travel to their objectives and return to collect the posted gold reward.\n\nAVAILABLE QUESTS\nChoose QUEST to open Available Quests, which lists unclaimed jobs. Heroes decide which jobs to accept; you do not order a hero to take a particular quest here. The visitor bar lists heroes currently inside the Guild; Nobody Here means it has no visitors.\n\nREFRESH\nPay 500 gold to replace unclaimed offers with up to six new quests when suitable objectives exist. Quests already underway continue.\n\nOnly one Adventurers Guild can be built per kingdom.'''

def patch_help(archive,aliases):
 sections=[]
 for sec in archive.sections:
  entries=[]
  for e in sec.entries:
   if sec.extension==b'STRT'and e.name[:4]==b'HPTX':
    table=parse_strt(e.data);values={r.string_id:r.text for r in table.records}
    for key,(kind,level)in aliases.items():
     text=AG_HELP if kind=='guild'else'ROYAL MENAGERIE - LEVEL '+str(level)+'\nCapacity: '+str({1:4,2:6,3:8}[level])+' captured beasts.\n\n'+ZOO_HELP
     values[int.from_bytes(key,'little')]=text.encode('cp1252')
    e=replace(e,data=replace(table,records=tuple(StrtRecord(k,v)for k,v in sorted(values.items()))).to_bytes())
   entries.append(e)
  sections.append(replace(sec,entries=tuple(entries)))
 return replace(archive,sections=tuple(sections))

def prepare(a):
 assert not a.out.exists();prior=json.loads((a.baseline/'baseline.json').read_text())['files'];raws={n:(a.baseline/n).read_bytes()for n in prior}
 for n,raw in raws.items():assert digest(raw)==prior[n]
 text=read_cam(raws['Data/textdata.cam']);smnu={e.name[:4]:e.data for s in text.sections if s.extension==b'SMNU'for e in s.entries};palace=reward_panel(smnu[b'AP41'],smnu[b'CGZC'])
 aliases={b'hAG1':('guild',1),b'hZ01':('zoo',1),b'hZ02':('zoo',2),b'hZ03':('zoo',3)}
 for name in ['Data/unittype.cam','DataMX/mx_Unittype.cam']:
  for sec in read_cam(raws[name]).sections:
   if sec.extension==b'DUNT':
    for e in sec.entries:
     if e.name[:4]in[b'ABv1',b'ABw1',b'ABw2',b'ABw3']:
      payload=unpack_chunk(unit_parts(e.data)[2],b'SECD')[3];aliases[payload[52:56]]=('guild',1)if e.name[:4]==b'ABv1'else('zoo',int(chr(e.name[3])))
 output={}
 for name,raw in raws.items():
  if name.endswith('Community-main.cam'):raw=(a.art/'Community-main.cam').read_bytes()
  elif name.endswith('textdata.cam'):raw=patch_text(read_cam(raw),palace).to_bytes()
  elif name.endswith('gpltext.cam'):raw=patch_help(read_cam(raw),aliases).to_bytes()
  elif name.endswith('.bcd'):
   slug='common'if'Common'in name else'base'if'Base'in name else'expansion';raw=(a.compiled/(slug+'.bcd')).read_bytes()
  output[name]=raw
 a.out.mkdir(parents=True)
 for name,raw in output.items():p=a.out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
 sources=['scripts/prepare-guild-usability-resources.py','scripts/prepare-guild-usability-art.py','scripts/prepare-guild-usability-gpl.py','scripts/prepare-guild-usability-engine.py','native/community/guild_usability_policy.h','native/community/guild_usability_probe.cpp','native/community/guild_usability_panels.cpp']
 proof={'format':'majesty-guild-usability-resources-v1','before':prior,'files':{n:digest(raw)for n,raw in output.items()},'helpAliases':{k.decode():v for k,v in aliases.items()},'openCloseWidgetsRemoved':True,'palaceCaptureWidget':5018,'sourcePolicies':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest()for n in sources}}
 (a.out/'usability-stage.json').write_text(json.dumps(proof,indent=2)+'\n');print('Prepared',len(output),'native resources and complete player-facing help.')
if __name__=='__main__':
 p=argparse.ArgumentParser()
 for n in ['baseline','art','compiled','out']:p.add_argument('--'+n,type=Path,required=True)
 prepare(p.parse_args())
