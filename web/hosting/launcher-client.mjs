// The automatic player needs one edition, not the setup dashboard's cards,
// storage estimates for every edition, and repeated status refreshes.
export async function launcherClient({signal, WorkerClass = Worker, fetchFile = fetch} = {}) {
  const games = await fetchFile(new URL('../games.json', import.meta.url), {signal}).then(r => {
    if (!r.ok) throw Error('The game configuration is unavailable.');
    return r.json();
  });
  signal?.throwIfAborted();
  const worker = new WorkerClass(new URL('../worker.js', import.meta.url), {type: 'module'});
  const pending = new Map();
  let next = 0, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    worker.terminate();
    for (const p of pending.values()) p.reject(new DOMException('Launch cancelled', 'AbortError'));
    pending.clear();
    signal?.removeEventListener('abort', close);
  };
  worker.onmessage = ({data}) => {
    if (data.progress) return;
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    data.error ? p.reject(Error(data.error)) : p.resolve(data.result);
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(Error('Game preparation stopped.'));
    pending.clear(); close();
  };
  signal?.addEventListener('abort', close, {once: true});
  const call = (cmd, id, args = {}) => {
    if (closed) return Promise.reject(new DOMException('Launch cancelled', 'AbortError'));
    const game = games.find(g => g.id === id);
    if (!game) return Promise.reject(Error('Unknown game edition.'));
    return new Promise((resolve, reject) => {
      const n = ++next;
      pending.set(n, {resolve, reject});
      worker.postMessage({id: n, cmd, game, ...args});
    });
  };
  const importGame = async (id, args) => {
    const r = await call('import', id, args);
    if (r?.result !== 'done') throw Error(r?.error || 'Game preparation did not finish.');
    return r;
  };
  return {games, status: id => call('status', id, {brief: true}),
    importZip: (id, file) => importGame(id, {kind: 'zip', file}),
    importFiles: (id, files) => importGame(id, {kind: 'files', files}), close};
}
