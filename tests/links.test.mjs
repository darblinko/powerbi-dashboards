import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGES = [
  'README.md',
  'docs/index.html',
  ...['online-retailer', 'auto-parts-supplier', 'supplement-cmo', 'device-quality'].map(dir => `docs/${dir}/index.html`)
];
const LINK = /\]\(([^)\s]+)\)|(?:href|src|srcset)="([^"]+)"/g;

function relativeLinks(file) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  return [...text.matchAll(LINK)]
    .map(([, markdown, attribute]) => (markdown ?? attribute).split('#')[0])
    .filter(link => link && !/^(?:[a-z]+:|\/\/)/i.test(link));
}

function resolves(file, link) {
  const target = join(ROOT, dirname(file), link);
  if (!existsSync(target)) return false;
  return !statSync(target).isDirectory() || existsSync(join(target, 'index.html'));
}

for (const file of PAGES) {
  test(`relative links in ${file} resolve`, () => {
    const broken = relativeLinks(file).filter(link => !resolves(file, link));
    assert.deepEqual(broken, []);
  });
}
