import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const [directory, base, port] = process.argv.slice(2), root = resolve(directory);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
createServer((request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(base)) throw new Error('outside base');
    const file = resolve(root, path.slice(base.length) || 'index.html');
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error('missing file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(readFileSync(file));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(Number(port), '127.0.0.1');
