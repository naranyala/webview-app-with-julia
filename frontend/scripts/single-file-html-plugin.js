import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function escapeInlineStyle(source) {
  return source.replace(/<\/style/gi, '<\\/style');
}

async function readAsset(distPath, assetPath) {
  if (!assetPath.startsWith('/') || assetPath.includes('..')) {
    throw new Error(`Cannot inline non-local asset: ${assetPath}`);
  }
  return readFile(resolve(distPath, assetPath.slice(1)), 'utf8');
}

// WebView receives HTML with `webview_set_html`, not a document URL. This
// plugin makes the production entry self-contained and preserves deferred
// script timing by running the bundled code after the parser creates #root.
export function pluginSingleFileHtml() {
  return {
    name: 'single-file-html',
    setup(api) {
      api.onAfterBuild(async () => {
        const distPath = resolve(process.cwd(), 'dist');
        const htmlPath = resolve(distPath, 'index.html');
        let html = await readFile(htmlPath, 'utf8');
        const scripts = [];

        for (const match of html.matchAll(
          /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
        )) {
          scripts.push(await readAsset(distPath, match[1]));
        }

        html = html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/g, '');
        for (const match of html.matchAll(
          /<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="stylesheet"[^>]*>/g,
        )) {
          const style = escapeInlineStyle(await readAsset(distPath, match[1]));
          html = html.replace(match[0], `<style>${style}</style>`);
        }

        html = html.replace(/<link rel="icon"[^>]*>/g, '');
        // Base64 keeps arbitrary bundle content (including `</script>`) from
        // terminating the bootstrap tag before the browser evaluates it.
        const bundles = scripts.map((source) =>
          Buffer.from(source).toString('base64'),
        );
        const bootstrap = `<script>window.addEventListener('DOMContentLoaded',()=>{for(const source of ${JSON.stringify(bundles)})Function(atob(source))();});</script>`;
        html = html.replace('</head>', `${bootstrap}</head>`);
        await writeFile(htmlPath, html);
      });
    },
  };
}
