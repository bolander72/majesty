#!/usr/bin/env python3
"""Extract the source-bound original SPLH raster without scanline wrapping."""
import argparse
import hashlib
import importlib.util
from pathlib import Path
import struct
import zlib

SPLH_SHA256 = 'a66c0e3e9a093b0e331891d3dee046ab5ed5dbe5d3d074d70720f8fe4136f5f0'
PIXEL_OFFSET = 20


def decode_pixels(record):
    if len(record) < PIXEL_OFFSET or struct.unpack_from('<4I', record) != (1, 131072, 0, 0):
        raise ValueError('Unsupported original SPLH header')
    width, height = struct.unpack_from('<HH', record, 16)
    if not 0 < width <= 4096 or not 0 < height <= 4096:
        raise ValueError('Invalid SPLH dimensions')
    end = PIXEL_OFFSET + width * height * 2
    if end > len(record):
        raise ValueError('Truncated SPLH pixels')
    # The raster begins at byte 20, not 48. Treating trailing storage as a
    # header shifts every row fourteen pixels and wraps the footer's left edge.
    pixels = bytearray()
    for y in reversed(range(height)):
        for x in range(width):
            value = struct.unpack_from('<H', record, PIXEL_OFFSET + 2 * (y * width + x))[0]
            pixels.extend(((value >> 10 & 31) * 255 // 31,
                           (value >> 5 & 31) * 255 // 31,
                           (value & 31) * 255 // 31))
    return width, height, bytes(pixels)


def png_bytes(width, height, pixels):
    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))
    rows = b''.join(b'\0' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path, help='Standalone decoded PNG')
    args = parser.parse_args()
    if args.archive.stat().st_flags & 0x40000000:
        raise ValueError('Original archive is not resident')
    spec = importlib.util.spec_from_file_location('cam', Path(__file__).with_name('prepare-wayfinder-native-resources.py'))
    cam = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cam)
    record = cam.cam_records(args.archive.read_bytes())[(b'PICT', b'SPLH')]
    if hashlib.sha256(record).hexdigest() != SPLH_SHA256:
        raise ValueError('Original SPLH source hash differs')
    width, height, pixels = decode_pixels(record)
    args.output.write_bytes(png_bytes(width, height, pixels))


if __name__ == '__main__':
    main()
