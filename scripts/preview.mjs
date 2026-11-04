// Serves dist/ on localhost under /preview/, so broken relative asset URLs show up as they would on a gateway subpath.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  if (!pathname.startsWith('/preview/')) {
    response.writeHead(302, { location: '/preview/' }).end();
    return;
  }
  const relative = normalize(decodeURIComponent(pathname.slice('/preview/'.length)) || 'index.html');
  if (relative.startsWith('..')) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(root + relative);
    response.writeHead(200, { 'content-type': types[extname(relative)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}/preview/`);
});
