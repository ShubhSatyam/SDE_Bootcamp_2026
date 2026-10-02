import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
const rootPath = fileURLToPath(root);

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) return filesUnder(fullPath);
    return [fullPath];
  }));
  return nested.flat();
}

const files = (await filesUnder(rootPath))
  .filter((path) => !path.endsWith(`${sep}sw.js`))
  .map((path) => `/${relative(rootPath, path).split(sep).join('/')}`);
const precache = JSON.stringify(files);
const serviceWorker = `const CACHE_NAME = 'calcink-${Date.now()}';
const PRECACHE_URLS = ${precache};
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('calcink-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
    return response;
  })());
});
`;
await writeFile(new URL('sw.js', root), serviceWorker);
console.log(`Generated offline cache manifest with ${files.length} assets.`);
