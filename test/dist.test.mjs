import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = new URL('../src/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

test('dist holds exactly the files in src, byte for byte', () => {
  const names = readdirSync(src).sort();
  assert.deepEqual(readdirSync(dist).sort(), names);
  for (const name of names) {
    assert.ok(readFileSync(new URL(name, src)).equals(readFileSync(new URL(name, dist))), `${name} differs`);
  }
});

test('index.html uses relative asset URLs and has its share tags', () => {
  const html = readFileSync(new URL('index.html', dist), 'utf8');
  for (const match of html.matchAll(/(?:href|src|content)="(\.?\/[^"]*)"/g)) {
    assert.ok(match[1].startsWith('./'), `${match[1]} is not relative`);
  }
  for (const pattern of [/<title>/, /rel="icon"/, /name="description"/, /property="og:title"/, /property="og:image"/]) {
    assert.match(html, pattern);
  }
});
