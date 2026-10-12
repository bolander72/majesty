#!/usr/bin/env python3
"""Limit the official FFmpeg dependency's fixed -j8 build to one make job.

Selected by the native and WASM video build presets. Does not change video support
or dependency sources; the normal game tools still configure and build it.
"""
import os
import sys

arguments = [argument for argument in sys.argv[1:] if argument != "-j8"]
os.execv("/usr/bin/make", ["/usr/bin/make", "-j1", *arguments])
