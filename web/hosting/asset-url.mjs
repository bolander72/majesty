// Immutable files in this project's public asset branch, plus legacy Blob
// locations for compatibility with previously exported edition manifests.
export function assetUrl(value) {
  const url = new URL(value);
  const github = url.hostname === 'raw.githubusercontent.com' &&
    /^\/bolander72\/majesty\/[a-f0-9]{40}\/assets\/[A-Za-z0-9_./-]+$/.test(url.pathname);
  const legacy = url.hostname.endsWith('.public.blob.vercel-storage.com');
  if (url.protocol !== 'https:' || (!github && !legacy) ||
      url.username || url.password || url.search || url.hash)
    throw Error('Invalid game asset location.');
  return url.href;
}
