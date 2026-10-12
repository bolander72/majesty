#!/usr/bin/env python3
"""Package the supported installation for the local browser's Import ZIP button."""
import argparse
import hashlib
from pathlib import Path
import tempfile
import zipfile

from hd_layouts import MODES, extended_layout

EXPECTED_SHA256 = "654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542"
FOLDERS = ("Data", "DataMX", "Quests", "QuestsMX", "Music")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("installation", type=Path)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "output/majesty-game.zip")
    args = parser.parse_args()
    root = args.installation.resolve()
    exe = root / "MajestyHD - Old.exe"
    if not exe.is_file() or hashlib.sha256(exe.read_bytes()).hexdigest() != EXPECTED_SHA256:
        parser.error("This installation does not contain the supported MajestyHD - Old.exe.")
    for folder in FOLDERS:
        if not (root / folder).is_dir():
            parser.error(f"Missing game folder: {folder}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    files = [exe]
    for folder in FOLDERS:
        files.extend(sorted(p for p in (root / folder).rglob("*") if p.is_file()))
    layout = (root / "Data/UIData_1920_1080.dat").read_bytes()
    additions = [(f"Data/UIData_{w}_{h}.dat", extended_layout(layout, w, h))
                 for w, h in MODES]
    if any((root / name).exists() for name, _ in additions):
        parser.error("An installed high-resolution layout already exists; preserve it before packaging.")
    with tempfile.NamedTemporaryFile(dir=args.out.parent, suffix=".zip.tmp", delete=False) as temp:
        temporary = Path(temp.name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for file in files:
                archive.write(file, file.relative_to(root).as_posix())
            for name, data in additions:
                archive.writestr(name, data)
        temporary.replace(args.out)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Packaged {len(files) + len(MODES)} files into {args.out.resolve()}")


if __name__ == "__main__":
    main()
