import esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const designToCodeEntry = join(root, '../design-to-code/src/index.ts');
const watch = process.argv.includes('--watch');

const uiHtmlTemplate = readFileSync(join(root, 'src/ui.html'), 'utf-8');
const SHOW_UI_MARKER = '__REPLACE_UI_HTML__';
const BUILD_VERSION_MARKER = '__BUILD_VERSION__';
const BUILD_VERSION = new Date().toISOString();

async function buildUiHtml() {
  const uiResult = await esbuild.build({
    entryPoints: [join(root, 'src/ui.ts')],
    bundle: true,
    write: false,
    target: 'es2017',
    logLevel: 'silent',
  });

  const uiJs = uiResult.outputFiles[0].text;
  const uiHtml = uiHtmlTemplate.replace('<!-- UI_SCRIPT -->', `<script>${uiJs}</script>`);
  writeFileSync(join(root, 'dist/ui.html'), uiHtml);
  return uiHtml;
}

async function buildCode(uiHtml) {
  await esbuild.build({
    entryPoints: [join(root, 'src/code.ts')],
    bundle: true,
    outfile: join(root, 'dist/code.js'),
    target: 'es2017',
    logLevel: 'info',
    alias: {
      '@connexup/design-to-code': designToCodeEntry,
    },
  });

  const codePath = join(root, 'dist/code.js');
  let code = readFileSync(codePath, 'utf-8');

  if (!code.includes(SHOW_UI_MARKER)) {
    throw new Error(`Build marker ${SHOW_UI_MARKER} not found in code bundle`);
  }
  if (!code.includes(BUILD_VERSION_MARKER)) {
    throw new Error(`Build marker ${BUILD_VERSION_MARKER} not found in code bundle`);
  }

  code = code.replace(/['"]__REPLACE_UI_HTML__['"]/, JSON.stringify(uiHtml));
  code = code.replace(BUILD_VERSION_MARKER, BUILD_VERSION);
  writeFileSync(codePath, code);
}

async function writeDistManifest() {
  const manifest = {
    name: 'Connex Design to Code v0.1.1',
    id: 'connex-design-to-code',
    api: '1.0.0',
    main: 'code.js',
    editorType: ['figma', 'dev'],
    capabilities: ['inspect'],
    documentAccess: 'dynamic-page',
    networkAccess: {
      allowedDomains: ['none'],
    },
  };
  writeFileSync(join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2));
}

async function build() {
  const uiHtml = await buildUiHtml();
  await buildCode(uiHtml);
  await writeDistManifest();
  console.log('Built figma-plugin → dist/');
}

if (watch) {
  const ctx = await esbuild.context({
    entryPoints: [join(root, 'src/code.ts')],
    bundle: true,
    outfile: join(root, 'dist/code.js'),
    target: 'es2017',
    logLevel: 'info',
    alias: {
      '@connexup/design-to-code': designToCodeEntry,
    },
  });
  await ctx.watch();
  console.log('Watching code.ts... (re-run build for UI HTML injection)');
} else {
  await build();
}
