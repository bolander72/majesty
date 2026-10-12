#!/usr/bin/env python3
"""Check that a native fixture refresh leaves browser-visible sources exact."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
SOURCE='upstream/majesty-recomp/browser_frontier.cpp'
GROUPS=('nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256','nativeOrderRuntimeSourceSha256')
def digest(data):return hashlib.sha256(data).hexdigest()

def browser_projection(text):
    """Erase only branches decided by the explicit Emscripten macro.

    Preserve opaque directives and both opaque branches byte-for-byte. Reject
    ambiguous elif within a decided branch instead of guessing its condition.
    """
    live=True;stack=[];out=[]
    for line in text.splitlines(keepends=True):
        directive=re.match(r'^\s*#\s*(if|ifdef|ifndef|else|elif|endif)\b(.*)',line)
        if not directive:
            if live:out.append(line)
            continue
        op,arg=directive.groups();arg=arg.strip()
        if op in ('if','ifdef','ifndef'):
            known=op in ('ifdef','ifndef') and arg=='__EMSCRIPTEN__'
            if op=='if' and arg in ('defined(__EMSCRIPTEN__)','!defined(__EMSCRIPTEN__)'):
                known=True;condition=not arg.startswith('!')
            else:condition=op=='ifdef'
            stack.append((live,known,condition))
            if known:live=live and condition
            elif live:out.append(line)
        elif op in ('else','elif'):
            if not stack:raise ValueError('Unbalanced source directive')
            parent,known,condition=stack[-1]
            if known:
                if op=='elif':raise ValueError('Ambiguous decided branch')
                live=parent and not condition
            elif live:out.append(line)
        else:
            if not stack:raise ValueError('Unbalanced source directive')
            parent,known,_=stack.pop()
            if not known and live:out.append(line)
            live=parent
    if stack:raise ValueError('Unclosed source directive')
    return ''.join(out)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('previous',type=Path);p.add_argument('current',type=Path);p.add_argument('archived_source',type=Path);p.add_argument('output',type=Path)
    args=p.parse_args()
    previous=json.loads(args.previous.read_text());current=json.loads(args.current.read_text())
    for build in (previous,current):assert build['nativeBuildQualified'] is True and build['exitCode']==0
    before={k:v for group in GROUPS for k,v in previous[group].items()}
    after={k:v for group in GROUPS for k,v in current[group].items()}
    assert before.keys()==after.keys()
    assert [k for k in before if before[k]!=after[k]]==[SOURCE]
    assert previous['nativeSymbolsSha256']==current['nativeSymbolsSha256']
    old=args.archived_source.read_bytes();new=(ROOT/SOURCE).read_bytes()
    assert len(old)<=4*1024*1024 and len(new)<=4*1024*1024
    assert digest(old)==before[SOURCE] and digest(new)==after[SOURCE]
    old_visible=browser_projection(old.decode());new_visible=browser_projection(new.decode())
    assert old_visible==new_visible
    for marker in ('NATIVE_COOP_WORLD_TRAVEL_SOURCE_IMPORT','NATIVE_COOP_WORLD_LATER_TARGET_SNAPSHOT','[coop-travel-target-fixture]'):
        assert marker in new.decode() and marker not in new_visible
    assert 'majesty_browser_coop_checkpoint_attach' in new_visible
    result=dict(version=1,previousBuild=str(args.previous),currentBuild=str(args.current),archivedPreviousSource=str(args.archived_source),
        previousSourceSha256=digest(old),currentSourceSha256=digest(new),browserVisibleSourceSha256=digest(new_visible.encode()),
        browserVisibleSourceUnchangedQualified=True,otherCompiledSourcesUnchangedQualified=True,generatedSymbolsUnchangedQualified=True,
        nativeExecutablePinReused=False,laterNativeFixturesExecutedQualified=False,browserUsed=False,goalComplete=False)
    with args.output.open('x')as stream:stream.write(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(browserVisibleSourceUnchanged=True,otherCompiledSourcesUnchanged=True,nativePinReused=False)))
if __name__=='__main__':main()
