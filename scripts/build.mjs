// The site is plain ES modules with no dependencies, so the production export is a copy of src/.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const src = new URL('../src/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(src, dist, { recursive: true });
console.log('Copied src/ to dist/');
