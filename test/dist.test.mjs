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

test('the share card is a 1200 by 630 PNG with large-card metadata', () => {
  const html = readFileSync(new URL('index.html', dist), 'utf8');
  assert.match(html, /property="og:image" content="\.\/og.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  const png = readFileSync(new URL('og.png', dist));
  assert.deepEqual(png.subarray(0,8), Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
