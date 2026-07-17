import assert from 'node:assert/strict';
import {
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distRoot = path.join(projectRoot, 'dist');
const forbiddenQaIdentifiers = [
  '__DKEC_GAME_TEST__',
  'setScenario',
  'releaseSpawns',
  'holdSpawns',
];
const expectedGameAssets = [
  'training-camp-background.png',
  'character-d-camo-front.png',
  'character-d-camo-back.png',
  'character-k-camo-front.png',
  'character-k-camo-back.png',
  'character-e-camo-front.png',
  'character-e-camo-back.png',
  'character-c-camo-front.png',
  'character-c-camo-back.png',
  'balloon-sprites.png',
  'heart-pickup.png',
  'dart-and-burst-sprites.png',
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));

  return nested.flat();
}

const distFiles = await listFiles(distRoot);
const bundledSources = distFiles.filter(
  (file) => ['.js', '.css'].includes(path.extname(file)),
);

for (const file of bundledSources) {
  const source = await readFile(file, 'utf8');

  for (const identifier of forbiddenQaIdentifiers) {
    assert.equal(
      source.includes(identifier),
      false,
      `${path.relative(projectRoot, file)} exposes QA identifier ${identifier}`,
    );
  }
}

const indexSource = await readFile(path.join(distRoot, 'index.html'), 'utf8');
const indexReferences = Array.from(
  indexSource.matchAll(/(?:src|href)="([^"]+)"/g),
  (match) => match[1],
).filter((reference) => reference.startsWith('/'));

for (const reference of indexReferences) {
  const referencedFile = path.join(
    distRoot,
    decodeURIComponent(reference.slice(1)),
  );
  const referencedStats = await stat(referencedFile);

  assert.equal(
    referencedStats.isFile(),
    true,
    `dist/index.html reference is not a file: ${reference}`,
  );
  assert.ok(
    referencedStats.size > 0,
    `dist/index.html reference is empty: ${reference}`,
  );
}

for (const assetName of expectedGameAssets) {
  const assetPath = path.join(distRoot, 'assets', 'game', assetName);
  const assetStats = await stat(assetPath);

  assert.equal(assetStats.isFile(), true, `missing built asset: ${assetName}`);
  assert.ok(assetStats.size > 0, `empty built asset: ${assetName}`);
}

console.log(
  `Production verification passed: ${bundledSources.length} bundles, `
  + `${indexReferences.length} index references, `
  + `${expectedGameAssets.length} game assets.`,
);
