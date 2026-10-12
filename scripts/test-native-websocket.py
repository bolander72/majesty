#!/usr/bin/env python3
"""Run the official native platform target against owned loopback WS/WSS fixtures."""
import argparse, asyncio, hashlib, json, logging, os, ssl, subprocess, tempfile, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt',type=int,required=True)
    args=parser.parse_args()
    out=ROOT/f'output/native-websocket-{args.attempt:03}'
    if args.attempt < 1 or out.exists(): parser.error('Use a fresh positive attempt')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(row.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja','cmake','platform_websocket_tests'] for row in rows if len(row.split(None,1))==2):
        parser.error('Another heavy game/build/test is live')
    out.mkdir()
    def digest(path):
        h=hashlib.sha256()
        with path.open('rb') as file:
            for chunk in iter(lambda:file.read(4096),b''): h.update(chunk)
        return h.hexdigest()
    files=['kit/platform/os_posix.cpp','kit/platform/os.h','kit/platform/CMakeLists.txt','kit/platform/tests/platform_tests.cpp','kit/tools/test.py','kit/tools/build.py']
    sources=[]
    for name in files:
        p=GAME/name;copy=out/name.replace('/','_');copy.write_bytes(p.read_bytes())
        sources.append(dict(source=str(p),copy=str(copy),sha256=digest(p)))
    copy=out/'runner.py';copy.write_bytes(Path(__file__).read_bytes())
    sources.append(dict(source=str(Path(__file__).resolve()),copy=str(copy),sha256=digest(copy)))
    served={}
    for name in ['MajestyRecomp.wasm','MajestyRecomp.js','MajestyRecomp.data','index.html']:
        p=GAME/'build/web-site/majesty'/name;stat=p.stat()
        served[name]=dict(sha256=digest(p),bytes=stat.st_size,inode=stat.st_ino,mtimeNs=stat.st_mtime_ns)
    paths={}; active=0; connections=0
    logger=logging.getLogger('native_ws_fixture');logger.addHandler(logging.NullHandler());logger.propagate=False
    async def handler(ws):
        nonlocal active,connections
        active+=1;connections+=1
        path=ws.request.path;paths[path]=paths.get(path,0)+1
        try:
            if path=='/text':await ws.send('unsupported text')
            elif path=='/empty':await ws.send(b'')
            elif path=='/oversize':await ws.send(bytes(66561))
            elif path=='/fragment-oversize':await ws.send([bytes(32768),bytes(32768),bytes(1025)])
            elif path=='/fragment-ok':await ws.send([b'abc',b'def'])
            elif path=='/count-flood':
                for _ in range(4097):await ws.send(b'x')
            elif path=='/byte-flood':
                payload=bytes(66560)
                for _ in range(33):await ws.send(payload)
            elif path=='/close':await ws.close()
            elif path=='/blackhole':await ws.wait_closed()
            elif path=='/delayed':
                message=await ws.recv();await asyncio.sleep(.1);await ws.send(message)
            elif path=='/echo':
                async for message in ws:await ws.send(message)
            else:await ws.wait_closed()
            await ws.wait_closed()
        except ConnectionClosed:pass
        finally:active-=1
    def select_protocol(ws,offered):
        return None if ws.request.path=='/no-protocol' else ('recomp-directplay-v1' if 'recomp-directplay-v1' in offered else None)
    with tempfile.TemporaryDirectory(prefix='owned-tls-',dir=out) as tls_dir:
        tls=Path(tls_dir);certificate=tls/'certificate.pem';key=tls/'key.pem'
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(certificate),'-days','1','-subj','/CN=localhost'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(certificate,key)
        options=dict(subprotocols=['recomp-directplay-v1'],select_subprotocol=select_protocol,compression=None,ping_interval=None,max_size=66560,max_queue=1,close_timeout=1,logger=logger)
        async with serve(handler,'127.0.0.1',0,**options) as server, serve(handler,'127.0.0.1',0,ssl=context,**options) as secure:
            port=server.sockets[0].getsockname()[1];tls_port=secure.sockets[0].getsockname()[1]
            env=os.environ.copy();env['NATIVE_WEBSOCKET_TEST_URL']=f'ws://127.0.0.1:{port}';env['NATIVE_WEBSOCKET_TEST_TLS_URL']=f'wss://127.0.0.1:{tls_port}/echo'
            command=['.venv/bin/python','tools/test.py','--native-test','platform_websocket_tests','--jobs','1']
            meta=dict(version=1,command=command,sources=sources,servedBefore=served,browserUsed=False,nativeWorldStarted=False,startedAtMs=time.time_ns()//1000000,loopbackOnly=True,platformCertificateTrustUnchanged=True)
            log=out/'official.log'
            with log.open('x') as file:
                process=await asyncio.create_subprocess_exec(*command,cwd=GAME,env=env,stdout=file,stderr=asyncio.subprocess.STDOUT)
                meta['testPid']=process.pid;(out/'run.json').write_text(json.dumps(meta,indent=2)+'\n')
                print(json.dumps(dict(testPid=process.pid,log=str(log))),flush=True)
                code=await process.wait()
            meta.update(exitCode=code,testTerminal=True,finishedAtMs=time.time_ns()//1000000,fixtureConnections=connections,fixturePaths=paths)
        assert active==0
    try:os.kill(process.pid,0)
    except ProcessLookupError:meta['producerAbsent']=True
    else:raise RuntimeError('test producer remains live')
    assert all(digest(Path(item['source']))==item['sha256'] for item in sources)
    for name,stamp in served.items():
        p=GAME/'build/web-site/majesty'/name;stat=p.stat();assert stamp==dict(sha256=digest(p),bytes=stat.st_size,inode=stat.st_ino,mtimeNs=stat.st_mtime_ns)
    meta.update(servedUnchanged=True,fixtureStopped=True,logSha256=digest(log),nativeWebsocketQualified=code==0,gameplayQualified=False,sharedSaveLoadResumeQualified=False,independentInternetQualified=False,sustainedBrowserMemoryBoundQualified=False,crashResolved=False,goalComplete=False,scope='Actual Foundation native transport against owned loopback binary WebSocket fixtures, queue limits, malformed/fragmented frames, callback cleanup and default refusal of self-signed TLS. No DirectPlay game session, browser, independent internet participant or loaded world.')
    exe=GAME/'build/recomp/platform_websocket_tests'
    if exe.exists():
        copy=out/'platform_websocket_tests';copy.write_bytes(exe.read_bytes());meta['binary']=dict(source=str(exe),copy=str(copy),sha256=digest(copy))
    trace=GAME/'build/cmake/macos/Testing/Temporary'/('LastTest.log' if code==0 else 'LastTest.log')
    if trace.exists():
        copy=out/('LastTest.log' if code==0 else 'LastTest-failed.log');copy.write_bytes(trace.read_bytes())
        for line in trace.read_text().splitlines():
            if 'native websocket:' in line and 'checks' in line:meta['result']=line
    (out/'run.json').write_text(json.dumps(meta,indent=2)+'\n');(ROOT/f'output/native-websocket-{args.attempt:03}-observed.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps({k:meta.get(k) for k in ['exitCode','result','fixtureConnections','producerAbsent','fixtureStopped']}),flush=True)
    print('\n'.join(log.read_text().splitlines()[-12:]))
    return code
if __name__=='__main__':raise SystemExit(asyncio.run(main()))
