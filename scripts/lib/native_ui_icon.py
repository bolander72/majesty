"""Reuse Majesty's native framed building-list icon, with new inset artwork."""
import struct
from PIL import Image, ImageOps


def framed_building_icon(source, tile, palette):
    # Purchased TILE1750: native 25px Ranger building-list emblem. Preserve
    # its two-pixel beveled border; its guild emblem is never reused.
    if (len(tile) != 651 or struct.unpack_from('<4H', tile) != (1,25,25,25)
            or struct.unpack_from('<H',tile,20)[0] != 0 or len(palette)!=1032):
        raise ValueError('Unsupported native building icon frame')
    pixels=bytearray()
    for index in tile[26:]:
        at=8+index*4
        pixels.extend(palette[at:at+3]+bytes([0 if index==255 else 255]))
    icon=Image.frombytes('RGBA',(25,25),bytes(pixels))
    # This is native UI composition/packing, not newly painted scene artwork.
    inset=Image.new('RGBA',(21,21),(9,18,13,255))
    icon.paste(inset,(2,2))
    bbox=source.getchannel('A').point(lambda a: 255 if a>=128 else 0).getbbox()
    if bbox is None:raise ValueError('Empty building emblem')
    emblem=ImageOps.contain(source.crop(bbox),(19,19),Image.Resampling.LANCZOS)
    icon.alpha_composite(emblem,((25-emblem.width)//2,(25-emblem.height)//2))
    return icon
