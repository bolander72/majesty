#!/bin/bash
set -euo pipefail
MAJESTY_WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
MAJESTY_PROJECT="$MAJESTY_WORKSPACE/upstream/majesty-recomp"
MAJESTY_INSTALL="${1:-/Users/mike/Applications/Majesty Gold HD.app/Contents/Resources/drive_c/GOG Games/Majesty Gold HD}"
MAJESTY_GHIDRA="$MAJESTY_WORKSPACE/.tools/ghidra_12.1.3_PUBLIC"
MAJESTY_JDK="${MAJESTY_JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
MAJESTY_PYTHON="${MAJESTY_PYTHON:-python3.12}"
mkdir -p "$MAJESTY_WORKSPACE/.tools" "$MAJESTY_WORKSPACE/upstream"
if [ ! -d "$MAJESTY_PROJECT/.git" ]; then
  git clone https://github.com/veritr1x/majesty-recomp.git "$MAJESTY_PROJECT"
  git -C "$MAJESTY_PROJECT" checkout 21186b12979414f6eb4a83db47a1283a8d8fbfea
  git -C "$MAJESTY_PROJECT" submodule update --init --recursive
fi
apply_browser_patch() {
  if git -C "$1" apply --check "$2" 2>/dev/null; then
    git -C "$1" apply "$2"
  elif ! git -C "$1" apply --reverse --check "$2" 2>/dev/null; then
    echo "The browser patch conflicts with local changes in $1; preserve those changes and resolve the patch." >&2
    exit 1
  fi
}
apply_browser_patch "$MAJESTY_PROJECT/kit" "$MAJESTY_WORKSPACE/patches/recomp-kit-browser.patch"
apply_browser_patch "$MAJESTY_PROJECT/kit" "$MAJESTY_WORKSPACE/patches/recomp-kit-startup-import-copy.patch"
apply_browser_patch "$MAJESTY_PROJECT/kit" "$MAJESTY_WORKSPACE/patches/recomp-kit-call-return-cache.patch"
apply_browser_patch "$MAJESTY_PROJECT" "$MAJESTY_WORKSPACE/patches/majesty-browser-defaults.patch"
if [ ! -x "$MAJESTY_PROJECT/.venv/bin/python" ]; then
  "$MAJESTY_PYTHON" -m venv "$MAJESTY_PROJECT/.venv"
fi
"$MAJESTY_PROJECT/.venv/bin/python" -m pip install -r "$MAJESTY_PROJECT/kit/requirements-dev.txt"
"$MAJESTY_PROJECT/.venv/bin/python" -m pip install -r "$MAJESTY_WORKSPACE/scripts/requirements-multiplayer.txt"
if [ ! -d "$MAJESTY_WORKSPACE/.tools/emsdk/.git" ]; then
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$MAJESTY_WORKSPACE/.tools/emsdk"
fi
(cd "$MAJESTY_WORKSPACE/.tools/emsdk" && ./emsdk install 6.0.10 && ./emsdk activate 6.0.10)
if [ ! -x "$MAJESTY_GHIDRA/support/analyzeHeadless" ]; then
  MAJESTY_ARCHIVE="$MAJESTY_WORKSPACE/.tools/ghidra_12.1.3_PUBLIC.zip"
  curl -L --fail --retry 3 --output "$MAJESTY_ARCHIVE" \
    https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.3_build/ghidra_12.1.3_PUBLIC_20260817.zip
  printf '%s  %s\n' 93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54 "$MAJESTY_ARCHIVE" | shasum -a 256 -c -
  unzip -q "$MAJESTY_ARCHIVE" -d "$MAJESTY_WORKSPACE/.tools"
fi
if [ ! -x "$MAJESTY_GHIDRA/Ghidra/Features/Decompiler/build/os/mac_arm_64/decompile" ]; then
  (cd "$MAJESTY_GHIDRA/support/gradle" && \
    JAVA_HOME="$MAJESTY_JDK" PATH="$MAJESTY_JDK/bin:$PATH" \
    SDKROOT="$(xcrun --sdk macosx --show-sdk-path)" ./gradlew buildNatives)
fi
cd "$MAJESTY_PROJECT"
.venv/bin/python tools/setup.py --install "$MAJESTY_INSTALL" --link-only
if [ ! -f 'analysis/decompiled/MajestyHD - Old.exe/functions.tsv' ]; then
  .venv/bin/python tools/analyze.py --ghidra-home "$MAJESTY_GHIDRA" --java-home "$MAJESTY_JDK"
fi
"$MAJESTY_PYTHON" "$MAJESTY_WORKSPACE/scripts/import-game.py" "$MAJESTY_INSTALL"
"$MAJESTY_WORKSPACE/scripts/build-web.sh" --regenerate
