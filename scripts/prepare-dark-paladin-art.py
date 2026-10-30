#!/usr/bin/env python3
"""Pack the approved original Dark Paladin renders into private native images.

Stock animation control metadata, generic fire effects and the UI panel/frame
are retained. No stock hero, castle, portrait or guild-emblem pixels survive.
This prepares a private candidate; it does not admit actors or publish a game.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from PIL import Image, ImageOps
from majesty_cam.cam import read_cam
from majesty_cam.art import parse_best_imag_tile_references, parse_tile_palette_reference
from lib.native_sprite_art import encode_tile, encode_cam
from lib.native_ui_icon import framed_building_icon
from lib.community_building_icons import native_frame, pack_emblem
from lib.vampiric_revenge import decode_tile


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def prepare(a):
    if a.out.exists():
        raise ValueError('Preserve earlier candidates')
    raw = a.stock.read_bytes()
    stock = read_cam(raw)
    sections = {s.extension: s for s in stock.sections}
    templates = {e.name[:4]: e for e in sections[b'IMAG'].entries}
    if {b'NDH1', b'NDG1', b'NDG2', b'NDG3'} & templates.keys():
        raise ValueError('Private image identities collide')
    old_tiles = sections[b'TILE'].entries
    # Use a verified ordinary guild world-sprite header, rather than the first
    # arbitrary terrain-overlay record in the source archive.
    header = old_tiles[1740].data[:26]
    if struct.unpack_from('<10H',header) != (3,192,250,0,32,132,63,7,0,0):
        raise ValueError('Ordinary native world-sprite header changed')
    frame, frame_palette = native_frame(a.stock)
    tiles, tile_hashes, audit = [(struct.pack('<I', 0), b'')], {}, []
    preview = {}

    def add(image, anchor, name, packed=None, world=False):
        if world:
            bounds=image.getchannel('A').point(lambda v:255 if v>=128 else 0).getbbox()
            if not bounds:raise ValueError('Empty world frame')
            left,top,right,bottom=bounds
            left=max(0,left-1);top=max(0,top-1)
            right=min(image.width,right+1);bottom=min(image.height,bottom+1)
            image=image.crop((left,top,right,bottom))
            anchor=(anchor[0]-left,anchor[1]-top)
        body = packed if packed is not None else encode_tile(image, header, anchor)
        decoded = decode_tile(body)
        if decoded.size != image.size:
            raise ValueError('Native decode changed frame dimensions')
        expected = image.convert('RGBA').getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        actual = decoded.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        if expected.tobytes() != actual.tobytes():
            raise ValueError('Native transparency round trip differs: ' + name)
        key = hashlib.sha256(body).digest()
        if key not in tile_hashes:
            tile_hashes[key] = len(tiles)
            tiles.append((struct.pack('<I', len(tiles)), body))
        preview[name] = decoded
        return tile_hashes[key]

    copied = {}
    def generic(index):
        if not index:
            return 0
        if index not in copied:
            body = bytearray(old_tiles[index].data)
            ref = parse_tile_palette_reference(body, tile_index=index)
            if ref:
                struct.pack_into('<HI', body, 20, 1, len(body))
                body.extend(sections[b'SPLT'].entries[ref.palette_index].data)
            copied[index] = len(tiles)
            tiles.append((struct.pack('<I', len(tiles)), bytes(body)))
        return copied[index]

    hero = {}
    records = json.loads((a.hero / 'render-manifest.json').read_text())['frames']
    expected = {(sid, d, f) for sid, n in [(1,8),(8,1),(16,8),(64,12),(96,16),(128,8)]
                for d in range(8) for f in range(n)}
    if {(r['state'],r['direction'],r['frame']) for r in records} != expected or len(records) != 424:
        raise ValueError('Require all 424 original directional frames')
    for r in records:
        key = r['state'], r['direction'], r['frame']
        image = Image.open(a.hero / r['file']).convert('RGBA')
        alpha = image.getchannel('A')
        bounds = alpha.point(lambda v: 255 if v >= 128 else 0).getbbox()
        if not bounds or min(bounds[:2]) <= 0 or bounds[2] >= image.width or bounds[3] >= image.height:
            raise ValueError('Rendered frame touches crop bounds: ' + r['file'])
        hero[key] = add(image.resize((128,128), Image.Resampling.LANCZOS),
                        (64,98), r['file'],world=True)
    portrait = Image.open(a.art / 'portrait-source.png').convert('RGBA')
    portraits = {sid: add(ImageOps.fit(portrait, size, Image.Resampling.LANCZOS),
                          (0,0), f'hero-ui-{sid}')
                 for sid, size in [(1000,(100,100)),(1002,(25,25))]}
    marker = add(Image.new('RGBA',(3,3),(194,150,67,255)),(2,1),'minimap')
    guild_sets = {}
    for level, directory in [(1,a.guild),(2,a.guild_level2),(3,a.guild_level3)]:
        buildings = {}
        for state in range(3):
            image = Image.open(directory / f'damage-{state}.png').convert('RGBA')
            buildings[state] = add(image.resize((250,192),Image.Resampling.LANCZOS),
                                   (132,63),f'guild-{level}-damage-{state}',world=True)
        collapse = []
        for n in range(42):
            image = Image.open(directory / f'collapse-{n:02d}.png').convert('RGBA')
            collapse.append(add(image.resize((250,192),Image.Resampling.LANCZOS),
                                (132,63),f'guild-{level}-collapse-{n}',world=True))
        guild_sets[level] = (buildings,collapse)
    construction = []
    for n in range(3):
        image = Image.open(a.construction / f'construction-{n}.png').convert('RGBA')
        construction.append(add(image.resize((250,192),Image.Resampling.LANCZOS),
                                (132,63),f'guild-construction-{n}',world=True))
    # Native guild cards use a painted narrative portrait, independently of
    # the isometric world sprite. Fill the stock 100-pixel portrait aperture.
    interior = Image.open(a.art / 'guild-interior-source.png').convert('RGBA')
    if interior.getchannel('A').getextrema() != (255,255):
        raise ValueError('Guild interior portrait must have an opaque backdrop')
    panel = ImageOps.fit(interior,(100,100),Image.Resampling.LANCZOS)
    guild_portrait = add(panel,(0,0),'guild-ui-1000')
    emblem = Image.open(a.art / 'guild-emblem-source.png').convert('RGBA')
    icon = framed_building_icon(emblem,frame,frame_palette)
    packed = pack_emblem(icon,frame[:26])
    icon_id = add(icon,(0,0),'guild-ui-1002',packed)
    decoded_icon = decode_tile(packed)
    if any(decoded_icon.getpixel((x,y)) != icon.getpixel((x,y))
           for y in range(25) for x in range(25) if min(x,y)<2 or x>=23 or y>=23):
        raise ValueError('Native icon border changed')

    def hero_ref(r):
        if r.set_id in [1,8,16,64,96,128]:
            return hero[r.set_id,(4-r.direction)%8,r.frame]
        if r.set_id in portraits:
            return portraits[r.set_id]
        if r.set_id == 224:
            return hero[96,0,15]
        if r.set_id == 400:
            return hero[8,4,0]
        if r.set_id == 300:
            return marker
        if r.set_id == 1001:
            return generic(r.tile_index)  # Native blank stone UI backing only.
        raise ValueError('Unaccounted hero image set: ' + str(r.set_id))

    def guild_ref(r,level=1):
        buildings,collapse = guild_sets[level]
        if r.set_id > 0xffffff:
            return generic(r.tile_index)  # Shared native fire-only effect layers.
        if r.set_id in [96,97,98,99,100,101]:
            return buildings[(r.set_id-96)//2]
        if r.set_id in [80,81,82]:
            return construction[r.set_id-80]
        if r.set_id in [192,208,400]:
            return buildings[0]
        if r.set_id == 224:
            return collapse[-1]
        if r.set_id == 240:
            return collapse[r.frame]
        if r.set_id == 1000:
            return guild_portrait
        if r.set_id == 1002:
            return icon_id
        raise ValueError('Unaccounted guild image set: ' + str(r.set_id))

    images = []
    for old_id,new_id,choose in [(b'AVF1',b'NDH1',hero_ref),
                               *[(b'ABW1',f'NDG{n}'.encode(),lambda r,n=n:guild_ref(r,n))
                                 for n in [1,2,3]]]:
        body = templates[old_id].data
        refs = parse_best_imag_tile_references(body,tile_count=len(old_tiles),entry_name=new_id).references
        changed = bytearray(body)
        for r in refs:
            struct.pack_into('<I',changed,r.offset,r.flag_bits|choose(r))
        reparsed = parse_best_imag_tile_references(changed,tile_count=len(tiles),entry_name=new_id)
        if len(reparsed.references) != len(refs):
            raise ValueError('Native reference shape changed')
        restored = bytearray(changed)
        for r in refs:
            struct.pack_into('<I',restored,r.offset,r.encoded_value)
        if bytes(restored) != body:
            raise ValueError('Non-reference animation controls changed')
        images.append((new_id+ b'DarkPaladin',bytes(changed)))
        audit.append(dict(image=new_id.decode(),references=len(refs),
                          layouts=sorted(set(r.layout for r in refs))))
    # Match the stock world renderer's external SPLT palette path. Keep each
    # authored palette explicit; UI-side raster decoding alone cannot qualify
    # the native renderer's embedded-palette handling.
    palettes, palette_ids, external_tiles = [], {}, []
    for label, body in tiles:
        if not body:
            external_tiles.append((label,body))
            continue
        mode,at=struct.unpack_from('<HI',body,20)
        if mode!=1 or len(body)!=at+1032:
            raise ValueError('Require a complete authored embedded palette')
        palette=body[at:]
        if palette not in palette_ids:
            palette_ids[palette]=len(palettes)
            palettes.append((struct.pack('<I',len(palettes)),palette))
        converted=bytearray(body[:at])
        struct.pack_into('<HI',converted,20,0,palette_ids[palette])
        external_tiles.append((label,bytes(converted)))
    output = encode_cam([(b'IMAG',images),(b'TILE',external_tiles),(b'SPLT',palettes)])
    a.out.mkdir(parents=True)
    (a.out/'Dark-Paladin-art.cam').write_bytes(output)
    for key in ['hero-ui-1000','hero-ui-1002','guild-ui-1000','guild-ui-1002',
                *[f'guild-{level}-{name}' for level in [1,2,3]
                  for name in ['damage-0','damage-1','damage-2','collapse-41']]]:
        preview[key].save(a.out/(key+'.png'))
    proof = dict(format='majesty-dark-paladin-native-art-v1',archive=digest(output),
                 stockControlSource=digest(raw),images=audit,directionalFrames=424,
                 collapseFrames=42,damageStates=3,tiles=len(tiles),
                 constructionStates=3,guildLevels=3,placementSet=192,
                 nativeGuildControlProfile='ABW1; original artwork replaces every building/portrait/emblem tile',
                 nativeDirections='render=(4-nativeDirection)%8; pending in-game verification',
                 alphaRoundTrip=True,nativeIconBorderExact=True,
                 nativeSurfaceHeaderSourceTile=1740,
                 externalPalettes=len(palettes),
                 worldFramesCroppedWithAnchorsPreserved=True,
                 reusedGenericResources=dict(uiBacking=True,uiFrame=True,fireOnlyTiles=len(copied)-1),
                 stockHeroCastlePortraitEmblemPixels=False,admitted=False,published=False)
    (a.out/'native-art-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps(proof))


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['stock','hero','guild','guild-level2','guild-level3','construction','art','out']:
        p.add_argument('--'+name,type=Path,required=True)
    prepare(p.parse_args())
