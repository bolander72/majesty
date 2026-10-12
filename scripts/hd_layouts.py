"""Extend the owned 1080p Majesty interface for optional 1440p and 4K modes.

Optional HD modes change geometry in the measured SMNU/APMK and SMNU/APdb
records. Responsive mode removes complete optional secondary HUD widgets so
construction uses the original primary panel. Retained artwork, strings,
widget types, identifiers and input bindings stay intact.
The CAM container and SMNU rectangle format were cross-checked against the
community Mod Manager's source and the installed native-resolution layouts.
No game data is bundled with this script.
"""
import hashlib
import struct


SOURCE_SHA256 = "8f78769a4d4dfec01fd671dc308cd33b1ecacc3cc36c957f4f35743a40932c04"
MODES = ((2560, 1440), (3840, 2160))


def cam_entries(data):
    """Read the game's bounded section directory without repacking its data."""
    if data[:12] != b"CYLBPC  \x01\x00\x01\x00":
        raise ValueError("Unsupported Majesty interface archive")
    count, header_size = struct.unpack_from("<II", data, 12)
    directory_end = 20 + 8 * count
    if count != 2 or directory_end + header_size > len(data):
        raise ValueError("Invalid interface directory")
    result = {}
    cursor = directory_end
    for i in range(count):
        section, offset = struct.unpack_from("<4sI", data, 20 + 8 * i)
        if offset != cursor:
            raise ValueError("Invalid section boundary")
        entries = struct.unpack_from("<I", data, cursor)[0]
        cursor += 8
        for _ in range(entries):
            name, start, size = struct.unpack_from("<20sII", data, cursor)
            cursor += 28
            if start < directory_end + header_size or start + size > len(data):
                raise ValueError("Invalid resource range")
            key = (section, name.rstrip(b"\0"))
            if key in result:
                raise ValueError("Duplicate resource")
            result[key] = (start, size)
    if cursor != directory_end + header_size:
        raise ValueError("Invalid content header length")
    return result


def extended_layout(source, width, height):
    if (width, height) not in MODES:
        raise ValueError("Only the measured 1440p and 4K targets are supported")
    return _extended_geometry(source, width, height)


def _extended_geometry(source, width, height):
    """Reference geometry for the runtime adapter's arbitrary browser viewport."""
    if not (800 <= width <= 8192 and 600 <= height <= 8192):
        raise ValueError("Viewport layout requires 800x600 through 8192x8192")
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("The installed 1080p layout differs from the verified input")
    entries = cam_entries(source)
    output = bytearray(source)
    start, size = entries[(b"SMNU", b"APMK")]
    words = struct.unpack_from(f"<{size // 4}i", source, start)
    dw, dh = width - 1920, height - 1080

    # Each measured widget starts with its type and property 2's x,y,w,h.
    # The root's -1 coordinates mean center/automatic placement, not pixels.
    rectangles = [i for i in range(1, len(words) - 6)
                  if words[i] == 2 and (i == 1 or words[i - 2] == -1)]
    if len(rectangles) != 68 or tuple(words[2:6]) != (-1, -1, 1920, 1080):
        raise ValueError("Unexpected main interface geometry")
    for i in rectangles:
        x, y, w, h = words[i + 1:i + 5]
        offset = i * 4
        if offset == 4:
            w, h = width, height
        else:
            if x >= 1800:
                x += dw
            elif offset in (248, 1668):
                x += dw // 2  # Quest title frame and its text widget.
            if y >= 674:
                y += dh  # Bottom HUD and the two lower information panels.
            if offset in (88, 476, 3684):
                w += dw  # Repeated top/bottom artwork and status text.
            if offset == 1828:
                w += dw
                h += dh  # The actual world viewport, not a scaled image.
            if offset in (3424, 5240):
                h += dh  # Repeated vertical borders cover the extra height.
            if offset == 4112:
                y += dh  # Lower right border retains its native artwork.
        struct.pack_into("<4i", output, start + offset + 4, x, y, w, h)

    # The status widget also owns a separate caption rectangle (property 42).
    if struct.unpack_from("<5i", source, start + 3704) != (42, 2, 3, 1312, 22):
        raise ValueError("Unexpected status caption geometry")
    struct.pack_into("<i", output, start + 3716, 1312 + dw)

    # The stock 1600x900 and 1920x1080 APdb records differ at exactly these
    # operands: bottom anchoring moves by 180 pixels, center anchoring by 90.
    # Preserve all other properties of this native panel.
    panel, panel_size = entries[(b"SMNU", b"APdb")]
    if panel_size != 13412:
        raise ValueError("Unexpected secondary interface size")
    bottom = {11472: 870, 11548: 991, 11624: 1021, 11700: 990,
              11784: 1021, 11868: 868, 12112: 931, 12196: 1036,
              12280: 1036, 12364: 1039, 12508: 1039, 12652: 951,
              13136: 1010}
    center = {11944: 505, 12028: 503}
    for fields, delta in ((bottom, dh), (center, dh // 2)):
        for offset, value in fields.items():
            if struct.unpack_from("<i", source, panel + offset)[0] != value:
                raise ValueError("Unexpected secondary interface operand")
            struct.pack_into("<i", output, panel + offset, value + delta)
    return bytes(output)


def responsive_layout(source, width, height):
    """Keep HD art with one native selection/construction and tracking panel."""
    if not (800 <= width <= 8192 and 600 <= height <= 8192):
        raise ValueError("Viewport layout requires800x600 through8192x8192")
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("The installed layout differs from the verified input")
    entries = cam_entries(source)
    base, count = entries[(b"SMNU", b"APMK")]
    main = source[base:base + count]
    if len(main) != 6948 or struct.unpack_from("<I", main, 5388)[0] != 4000:
        raise ValueError("Unexpected HD secondary selection binding")
    # Drop complete optional widget records, retaining the first tracker's
    # right border and the root terminator. No native action/ID is rewritten.
    main = main[:5320] + main[5480:5564] + main[6944:6948]
    end = 36 + struct.unpack_from("<I", source, 16)[0]
    output = bytearray(source[:end])
    for section in range(2):
        kind, index = struct.unpack_from("<4sI", source, 20 + section * 8)
        count = struct.unpack_from("<I", source, index)[0]
        for ordinal in range(count):
            entry = index + 8 + ordinal * 28
            name, at, size = struct.unpack_from("<20sII", source, entry)
            payload = main if (kind, name.rstrip(b"\0")) == (b"SMNU", b"APMK") else source[at:at+size]
            struct.pack_into("<II", output, entry + 20, len(output), len(payload))
            output.extend(payload)
    entries = cam_entries(output)
    start, size = entries[(b"SMNU", b"APMK")]
    words = struct.unpack_from(f"<{size // 4}i", output, start)
    rectangles = [i for i in range(1, len(words) - 6) if words[i] == 2 and (i == 1 or words[i - 2] == -1)]
    if size != 5408 or len(rectangles) != 52:
        raise ValueError("Unexpected single-panel HD HUD")
    dw, dh = width - 1920, height - 1080
    tracker = {964:170,5004:171,3600:171,3340:173,5324:173,4860:43,696:27,
               **dict.fromkeys((1560,1920,2028,2144,2260,2376,4504,4744),24)}
    for i in rectangles:
        at = i * 4
        x, y, w, h = words[i+1:i+5]
        if at == 4:
            w, h = width, height
        else:
            if x >= 1800:
                x += dw
            elif at in (248,1668):
                x += dw // 2
            if y >= 674:
                y += dh
            if at in (88,476,3684):
                w += dw
            if at == 1828:
                w += dw; h += dh
            if at in (3424,5240):
                h += dh
            if at == 4112:
                y += dh
            if at in tracker:
                y = height - tracker[at]
        struct.pack_into("<4i", output, start + at + 4, x, y, w, h)
    struct.pack_into("<i", output, start + 3716, 1312 + dw)
    panel, _ = entries[(b"SMNU", b"APdb")]
    for at in (11472,11548,11624,11700,11784,11868,12112,12196,12280,12364,12508,12652,13136):
        value = struct.unpack_from("<i", output, panel+at)[0]
        struct.pack_into("<i", output, panel+at, value+dh)
    for at in (11944,12028):
        value = struct.unpack_from("<i", output, panel+at)[0]
        struct.pack_into("<i", output, panel+at, value+dh//2)
    return bytes(output)
