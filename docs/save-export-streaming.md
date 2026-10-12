# Save backups as the world grows

The launcher previously collected every profile path, read each entire file
into an ArrayBuffer and retained all payloads before constructing its ZIP.
Saved regions made that explicit memory allocation grow with the whole backup.

The source launcher now exports to a selected folder when the browser exposes
`showDirectoryPicker`. It creates a dated ZIP with a fresh UUID filename and
checks that the candidate name does not already exist. It reports the filename
after the output closes. An empty profile creates neither an output nor a
temporary index. Concurrent export requests are refused.

The worker pulls files lazily through directory iterators, reads at most 64 KiB
per source read and awaits each destination write before reading again. ZIP
directory records go to a temporary OPFS file and are copied back in blocks of
at most 64 KiB. The explicit source buffer and index-copy buffer do not grow
with the total size of saved regions. Temporary index storage grows with the
number and length of filenames; directory traversal has a 64-level limit.

On normal errors, the worker aborts the output, closes the index handle,
attempts to remove the index and its own incomplete destination, and closes
the source iterator. It never opens an earlier backup for writing or removes
one. Cleanup after worker termination, permission revocation or an underlying
filesystem failure is not guaranteed. External concurrent filesystem changes
have not been tested.

The folder choice avoids `showSaveFilePicker`: its published algorithm clears
the selected entry before returning the handle, so writer rollback alone
cannot prove preservation of a previously selected file. See the
[File System Access picker specification](https://wicg.github.io/file-system-access/#api-showsavefilepicker).
The output uses the close/abort semantics described by the
[File System standard](https://fs.spec.whatwg.org/#api-filesystemfilehandle-createwritable).
Actual picker permissions, handle transfer to a worker and disk operations
still require a real browser test.

Browsers without the folder picker retain the download path. That path computes
CRCs in the same bounded chunks and retains File references and ZIP metadata,
rather than whole source ArrayBuffers. The final Blob, metadata arrays and
download implementation are **not** qualified as constant-memory operations.

Archives are stored ZIPs with CRC-32, UTF-8 names and signed data descriptors,
following the [PKWARE ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).
The writer refuses classic-ZIP overflow: at most 65,534 files and an archive
strictly smaller than 4,294,967,295 bytes, including headers and the index.
ZIP64 exports or multi-volume backups remain future work. Backups include
profile files; this is not a transactionally consistent multiplayer checkpoint
or a new portable account format.

## Verification

- Fourteen focused Node tests pass. They execute the actual worker message
  handler and export-button handler against synthetic filesystem/DOM fixtures.
  Coverage includes backpressure, nested Unicode paths, empty files, short and
  changed reads, cancellation, index truncation, count/size overflow, collision
  and permission refusal, concurrent exports, error cleanup, retry and URL
  release. A 2,200-file fixture exercises multiple index-copy blocks.
- Python's independent ZIP reader checks CRCs, filenames and payload hashes.
- The official launcher suite passes three Python tests, including core,
  export, player-identity and logging Node suites. Packaging copies the new
  module and serves `.mjs` with a JavaScript MIME type.
- The native co-op plan007's 48 compiled source inputs, six supervisor inputs,
  settings and executable still match. The served engine artifacts retain
  their hashes, inodes and modification times.

Evidence: `output/save-stream-003-folder-focused.tap`,
`output/save-stream-004-launcher.log`, and
`output/save-stream-005-boundaries.json`. The earlier invocation from the wrong
virtual-environment directory is retained in `output/save-stream-002-launcher.log`;
the successful suite uses the existing game `.venv-py314` environment.

No browser, game process, build, relay or tunnel was started for this change.
The source launcher has not been published to the served site. Browser launch
suspension remains in force. This change removes one explicit backup-allocation
problem; it does not establish bounded game memory, live co-op completion,
independent-machine internet play or seamless hero travel.
