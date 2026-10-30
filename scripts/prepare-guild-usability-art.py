#!/usr/bin/env python3
"""Resize native guild world art and all of its footprint/attachment geometry.

Keep original native UI images, animation clocks, other image identities, and
all existing TILE/SPLT slots. Append only scaled world-frame payloads.
"""
import argparse,hashlib,json,struct,sys
from pathlib import Path
from dataclasses import replace
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from PIL import Image
from majesty_cam.cam import read_cam,CamEntry
from majesty_cam.art import parse_best_imag_tile_references
from lib.vampiric_revenge import decode_tile

SCALES={b'AGB1':.60,b'ABn1':.78,b'ABn2':.78,b'ABn3':.78}
def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def scale_archive(archive):
 sections={s.extension:s for s in archive.sections};original_tiles=sections[b'TILE'].entries;tiles=list(original_tiles);palettes=list(sections[b'SPLT'].entries);cache={};audit=[]
 def resize(index,factor):
  if not index:return 0
  if(index,factor)in cache:return cache[index,factor]
  body=bytearray(original_tiles[index].data)
  mode,palette_index=struct.unpack_from('<HI',body,20)
  assert mode==0, 'World source tiles must use their original shared palettes'
  original_palette=sections[b'SPLT'].entries[palette_index].data
  version,height,width=struct.unpack_from('<HHH',body)
  assert version==3
  # Native indexed pixels include control operations, not just RGB colors.
  # Resize their indices and run coverage together without re-quantization.
  values=bytearray(width*height);coverage=bytearray(width*height)
  for y in range(height):
   at=26+struct.unpack_from('<I',body,26+y*4)[0]
   while True:
    end,flags=struct.unpack_from('<HH',body,at);at+=4;n=flags&0x7fff
    start=y*width+end-n;values[start:start+n]=body[at:at+n];coverage[start:start+n]=b'\xff'*n
    at+=n
    if flags&0x8000:break
  # Use the same self-paletted encoder as the shipped Dark Paladin art.
  # Keep generated color indices clear of the native control-color range.
  rgba=Image.new('RGBA',(width,height))
  colors=original_palette[8:1032]
  for pixel,color_index in enumerate(values):
   if coverage[pixel] and color_index<247:
    rgba.putpixel((pixel%width,pixel//width),(*colors[color_index*4:color_index*4+3],255))
  size=tuple(max(1,round(v*factor))for v in (width,height))
  rgba=rgba.resize(size,Image.Resampling.LANCZOS)
  from lib.native_sprite_art import encode_tile
  anchor=tuple(round(v*factor)for v in struct.unpack_from('<hh',body,10))
  packed=encode_tile(rgba,body[:26],anchor)
  decoded=decode_tile(packed)
  assert decoded.size==size
  result=len(tiles);tiles.append(CamEntry(struct.pack('<I',result).ljust(20,b'\0'),bytes(packed)))
  cache[index,factor]=result;return result
 def xy(raw,offset,factor,count=2):
  values=struct.unpack_from('<'+'h'*count,raw,offset);struct.pack_into('<'+'h'*count,raw,offset,*(round(v*factor)for v in values))
 images=[]
 for entry in sections[b'IMAG'].entries:
  factor=SCALES.get(entry.name[:4])
  if factor is None:images.append(entry);continue
  raw=bytearray(entry.data);assert struct.unpack_from('<I',raw)[0]==4
  parsed=parse_best_imag_tile_references(raw,tile_count=len(original_tiles),entry_name=entry.name)
  refs=[r for r in parsed.references if(r.set_id&0xffffff)<1000]
  world_sets={r.set_id for r in refs};count=struct.unpack_from('<I',raw,20)[0];rectangles=0
  for i in range(count):
   sid,start=struct.unpack_from('<II',raw,24+i*8)
   if sid not in world_sets:continue
   directions=struct.unpack_from('<I',raw,start)[0]
   for d in range(directions):
    at=start+struct.unpack_from('<i',raw,start+64+d*4)[0];xy(raw,at,factor)
    rectmask,aux=struct.unpack_from('<II',raw,at+8)
    for j in range(rectmask.bit_count()):xy(raw,at+20+j*8,factor,4);rectangles+=1
    cursor=at+20+rectmask.bit_count()*8
    for _ in range(aux.bit_count()):
     points=struct.unpack_from('<I',raw,cursor)[0];cursor+=4;assert points<=1024
     for _ in range(points):
      point=struct.unpack_from('<ii',raw,cursor);assert max(map(abs,point))<=4096
      struct.pack_into('<ii',raw,cursor,*(round(v*factor)for v in point));cursor+=8
  for r in refs:
   xy(raw,r.offset-4,factor);struct.pack_into('<I',raw,r.offset,r.flag_bits|resize(r.tile_index,factor))
  after=parse_best_imag_tile_references(raw,tile_count=len(tiles),entry_name=entry.name)
  assert len(after.references)==len(parsed.references)
  images.append(replace(entry,data=bytes(raw)));audit.append({'image':entry.name[:4].decode(),'scale':factor,'worldReferences':len(refs),'scaledGeometryRectangles':rectangles,'uiFramesUnchanged':True})
 assert {r['image']for r in audit}=={k.decode()for k in SCALES}
 result=replace(archive,sections=tuple(replace(s,entries=tuple(images if s.extension==b'IMAG'else tiles if s.extension==b'TILE'else palettes))if s.extension in[b'IMAG',b'TILE',b'SPLT']else s for s in archive.sections))
 return result,{'images':audit,'newTiles':len(tiles)-len(original_tiles),'originalTilesPreserved':True,'originalPalettesPreserved':True,'footprintsAndAttachmentPointsScaled':True}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();assert not a.out.exists();a.out.mkdir(parents=True)
 raw=a.input.read_bytes();archive,proof=scale_archive(read_cam(raw));result=archive.to_bytes();(a.out/'Community-main.cam').write_bytes(result);proof.update(before=digest(raw),after=digest(result));(a.out/'scale-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
