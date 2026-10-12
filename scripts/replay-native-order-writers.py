#!/usr/bin/env python3
"""Replay the current pinned writer fixture into a fresh preserved output."""
import argparse,hashlib,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
if a.output.exists():p.error('Preserve previous writer evidence')
spec=importlib.util.spec_from_file_location('original_writers',ROOT/'scripts/check-native-order-writers.py')
writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
writer.OUTPUT=a.output;writer.main()
r=json.loads(a.output.read_text());assert r['qualified'] and r['completedCalls']==20
r['sourceSha256']['scripts/replay-native-order-writers.py']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
a.output.write_text(json.dumps(r,indent=2)+'\n')
