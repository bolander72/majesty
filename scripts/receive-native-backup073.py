#!/usr/bin/env python3
"""Receive one isolated test backup through the fixture's public browser UI.

Loopback only; no game launches, profile writes, arbitrary upload paths or
default-service changes. Exits after one successful bounded upload.
"""
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'output/player-backup-native073-restored.zip'
RECEIPT = ROOT / 'output/player-backup-native073-restored-upload.json'
ORIGIN = 'http://localhost:8000'
LIMIT = 8 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def respond(self, code, value):
        data = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if self.path != '/restored-backup073' or self.headers.get('Origin') != ORIGIN:
            self.respond(403, {'error': 'Unknown fixture origin or route.'})
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Backup-SHA256')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        if self.path != '/restored-backup073' or self.headers.get('Origin') != ORIGIN:
            self.respond(403, {'error': 'Unknown fixture origin or route.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= LIMIT:
            self.respond(413, {'error': 'Fixture backup exceeds budget.'})
            return
        digest = sha256()
        owned = False
        try:
            with DESTINATION.open('xb') as sink:
                owned = True
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        raise ValueError('Truncated fixture upload.')
                    digest.update(chunk)
                    sink.write(chunk)
                    remaining -= len(chunk)
            if digest.hexdigest() != self.headers.get('X-Backup-SHA256'):
                raise ValueError('Fixture upload hash mismatch.')
            result = {'bytes': length, 'sha256': digest.hexdigest(), 'archive': str(DESTINATION),
                      'browserPublicStorageExport': True, 'nativeGameplayQualified': False}
            with RECEIPT.open('x') as sink:
                json.dump(result, sink, indent=2)
                sink.write('\n')
            self.server.accepted = True
            self.respond(201, result)
        except (ValueError, OSError) as error:
            if owned:
                DESTINATION.unlink(missing_ok=True)
            self.respond(409, {'error': str(error)[:200]})


if __name__ == '__main__':
    if DESTINATION.exists() or RECEIPT.exists():
        raise SystemExit('Preserve existing fixture archive and receipt.')
    with HTTPServer(('127.0.0.1', 8013), Handler) as server:
        server.timeout = 2
        server.accepted = False
        print('Isolated backup receiver ready on loopback8013.', flush=True)
        while not server.accepted:
            server.handle_request()
    print('Isolated backup received; receiver stopped.', flush=True)
