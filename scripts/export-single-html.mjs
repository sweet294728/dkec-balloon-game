import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXPECTED_IMAGE_COUNT = 12;

function assetFilePath(distDir, publicPath) {
  return path.join(distDir, publicPath.replace(/^\/+/, ''));
}

function findBundleTag(html, kind) {
  if (kind === 'script') {
    const tag = html.match(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/i);
    if (!tag) {
      throw new Error('Production index does not reference a JavaScript bundle.');
    }
    return { markup: tag[0], publicPath: tag[1] };
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const stylesheet = linkTags.find((tag) => /\brel=["']stylesheet["']/i.test(tag));
  const href = stylesheet?.match(/\bhref=["']([^"']+\.css)["']/i);
  if (!stylesheet || !href) {
    throw new Error('Production index does not reference a CSS bundle.');
  }
  return { markup: stylesheet, publicPath: href[1] };
}

export async function exportSingleHtml({ distDir, outputPath }) {
  const indexPath = path.join(distDir, 'index.html');
  const sourceHtml = await readFile(indexPath, 'utf8');
  const scriptTag = findBundleTag(sourceHtml, 'script');
  const styleTag = findBundleTag(sourceHtml, 'style');
  let javascript = await readFile(
    assetFilePath(distDir, scriptTag.publicPath),
    'utf8',
  );
  let css = await readFile(
    assetFilePath(distDir, styleTag.publicPath),
    'utf8',
  );

  const gameAssetDir = path.join(distDir, 'assets', 'game');
  const imageNames = (await readdir(gameAssetDir))
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort((left, right) => left.localeCompare(right));

  if (imageNames.length !== EXPECTED_IMAGE_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_IMAGE_COUNT} PNG game assets, found ${imageNames.length}.`,
    );
  }

  for (const imageName of imageNames) {
    const publicPath = `/assets/game/${imageName}`;
    if (!javascript.includes(publicPath)) {
      throw new Error(`JavaScript bundle does not reference ${imageName}.`);
    }
    const image = await readFile(path.join(gameAssetDir, imageName));
    const dataUri = `data:image/png;base64,${image.toString('base64')}`;
    javascript = javascript.replaceAll(publicPath, dataUri);
    css = css.replaceAll(publicPath, dataUri);
  }

  const safeJavascript = javascript.replaceAll('</script', '<\\/script');
  let html = sourceHtml
    .replace(styleTag.markup, () => `<style>${css}</style>`)
    .replace(
      scriptTag.markup,
      () => `<script type="module">${safeJavascript}</script>`,
    );

  const embeddedImageUris = html.match(
    /data:image\/png;base64,[A-Za-z0-9+/=]+/g,
  ) ?? [];
  const uniqueEmbeddedImageCount = new Set(embeddedImageUris).size;
  if (uniqueEmbeddedImageCount !== EXPECTED_IMAGE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_IMAGE_COUNT} unique embedded PNG images, found ${uniqueEmbeddedImageCount}.`,
    );
  }
  if (/\/assets\//.test(html)) {
    const unresolved = html.match(/.{0,80}\/assets\/.{0,160}/s)?.[0] ?? '/assets/';
    throw new Error(
      `Single HTML export still contains an unresolved /assets/ path near: ${unresolved}`,
    );
  }
  if (!/<style>[\s\S]+<\/style>/.test(html)) {
    throw new Error('Single HTML export does not contain embedded CSS.');
  }
  if (!/<script type="module">[\s\S]+<\/script>/.test(html)) {
    throw new Error('Single HTML export does not contain embedded JavaScript.');
  }
  if (!/<div id=["']root["']><\/div>/.test(html)) {
    throw new Error('Single HTML export does not contain the game root node.');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');
  return {
    outputPath,
    imageCount: uniqueEmbeddedImageCount,
    imageReferenceCount: embeddedImageUris.length,
    byteLength: Buffer.byteLength(html),
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile && pathToFileURL(invokedFile).href === import.meta.url) {
  const projectDir = path.dirname(path.dirname(currentFile));
  const result = await exportSingleHtml({
    distDir: path.join(projectDir, 'dist'),
    outputPath: path.join(
      projectDir,
      'export',
      'DKEC氣球特攻隊-單檔版.html',
    ),
  });
  console.log(
    `Single HTML export passed: ${result.imageCount} images, ${result.byteLength} bytes.`,
  );
  console.log(result.outputPath);
}
