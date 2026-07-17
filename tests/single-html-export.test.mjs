import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { exportSingleHtml } from '../scripts/export-single-html.mjs';

const assetNames = Array.from(
  { length: 12 },
  (_, index) => `fixture-${String(index + 1).padStart(2, '0')}.png`,
);

async function createFixture({
  cssReferencedAsset = false,
  duplicateLastReference = false,
  imageCount = 12,
  referencedCount = 12,
  replacementToken = false,
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dkec-single-html-'));
  const distDir = path.join(root, 'dist');
  const gameAssetDir = path.join(distDir, 'assets', 'game');
  const outputPath = path.join(root, 'export', 'game.html');
  await mkdir(gameAssetDir, { recursive: true });

  await writeFile(
    path.join(distDir, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="zh-Hant"><head><meta charset="UTF-8">',
      '<link rel="stylesheet" href="/assets/index-test.css">',
      '<script type="module" src="/assets/index-test.js"></script>',
      '</head><body><div id="root"></div></body></html>',
    ].join(''),
    'utf8',
  );
  await writeFile(
    path.join(distDir, 'assets', 'index-test.css'),
    cssReferencedAsset
      ? `body { background: url(/assets/game/${assetNames[0]}); }`
      : 'body { background: #123; }',
    'utf8',
  );
  await writeFile(
    path.join(distDir, 'assets', 'index-test.js'),
    `${replacementToken ? 'const token="$&";' : ''}const assets=${JSON.stringify(
      [
        ...assetNames
        .slice(0, referencedCount)
        .map((name) => `/assets/game/${name}`),
        ...(duplicateLastReference
          ? [`/assets/game/${assetNames.at(-1)}`]
          : []),
      ],
    )};document.querySelector('#root').textContent=assets.length;`,
    'utf8',
  );

  for (const [index, name] of assetNames.slice(0, imageCount).entries()) {
    await writeFile(
      path.join(gameAssetDir, name),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, index]),
    );
  }

  return { root, distDir, outputPath };
}

test('exports one self-contained HTML with twelve embedded PNG assets', async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const result = await exportSingleHtml(fixture);
  const html = await readFile(fixture.outputPath, 'utf8');

  assert.equal(result.imageCount, 12);
  assert.equal(result.outputPath, fixture.outputPath);
  assert.ok(result.byteLength > 0);
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.match(html, /<script type="module">[\s\S]+<\/script>/);
  assert.equal((html.match(/data:image\/png;base64,/g) ?? []).length, 12);
  assert.doesNotMatch(html, /\/assets\//);
  assert.match(html, /<div id="root"><\/div>/);
});

test('rejects a production directory that does not contain twelve PNGs', async (t) => {
  const fixture = await createFixture({ imageCount: 11 });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  await assert.rejects(
    exportSingleHtml(fixture),
    /Expected exactly 12 PNG game assets, found 11/,
  );
});

test('supports multiple JavaScript references to the same PNG asset', async (t) => {
  const fixture = await createFixture({ duplicateLastReference: true });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const result = await exportSingleHtml(fixture);
  const html = await readFile(fixture.outputPath, 'utf8');

  assert.equal(result.imageCount, 12);
  assert.equal((html.match(/data:image\/png;base64,/g) ?? []).length, 13);
  assert.equal(
    new Set(html.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)).size,
    12,
  );
});

test('embeds a PNG shared by the CSS and JavaScript bundles', async (t) => {
  const fixture = await createFixture({ cssReferencedAsset: true });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const result = await exportSingleHtml(fixture);
  const html = await readFile(fixture.outputPath, 'utf8');

  assert.equal(result.imageCount, 12);
  assert.equal((html.match(/data:image\/png;base64,/g) ?? []).length, 13);
  assert.doesNotMatch(html, /\/assets\//);
});

test('preserves JavaScript replacement tokens as literal bundle content', async (t) => {
  const fixture = await createFixture({ replacementToken: true });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const result = await exportSingleHtml(fixture);
  const html = await readFile(fixture.outputPath, 'utf8');

  assert.equal(result.imageCount, 12);
  assert.match(html, /const token="\$&";/);
  assert.equal((html.match(/<script type="module">/g) ?? []).length, 1);
});

test('rejects a PNG that the JavaScript bundle does not reference', async (t) => {
  const fixture = await createFixture({ referencedCount: 11 });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  await assert.rejects(
    exportSingleHtml(fixture),
    /JavaScript bundle does not reference fixture-12\.png/,
  );
});
