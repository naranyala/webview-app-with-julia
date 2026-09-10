const fs = require('node:fs/promises');
const path = require('node:path');

const remoteAsset = /^(?:[a-z]+:|\/\/|data:|#)/i;

function localAssetPath(url, htmlPath, publicDirectory) {
  const cleanUrl = url.split(/[?#]/, 1)[0];

  if (!cleanUrl || remoteAsset.test(cleanUrl)) {
    return null;
  }

  if (cleanUrl.startsWith('/')) {
    return path.resolve(publicDirectory, `.${cleanUrl}`);
  }

  return path.resolve(path.dirname(htmlPath), cleanUrl);
}

async function replaceAsync(value, pattern, replacer) {
  const replacements = [];
  value.replace(pattern, (...args) => {
    replacements.push(replacer(...args));
    return args[0];
  });

  const resolved = await Promise.all(replacements);
  let index = 0;

  return value.replace(pattern, () => resolved[index++]);
}

function singleFileHtmlPlugin({
  html = 'public/index.html',
  output = 'dist/index.html',
  publicDir = 'public'
} = {}) {
  const htmlPath = path.resolve(html);
  const outputPath = path.resolve(output);
  const publicDirectory = path.resolve(publicDir);

  return {
    name: 'single-file-html',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          return;
        }

        try {
          let document = await fs.readFile(htmlPath, 'utf8');

          document = await replaceAsync(
            document,
            /<link\b([^>]*?)\bhref=(['"])([^'"]+)\2([^>]*)>/gi,
            async (tag, before, _quote, href, after) => {
              if (!/\brel=(['"])stylesheet\1/i.test(`${before}${after}`)) {
                return tag;
              }

              const assetPath = localAssetPath(href, htmlPath, publicDirectory);
              if (!assetPath) {
                return tag;
              }

              const css = await fs.readFile(assetPath, 'utf8');
              return `<style>${css}</style>`;
            }
          );

          document = await replaceAsync(
            document,
            /<script\b([^>]*?)\bsrc=(['"])([^'"]+)\2([^>]*)>\s*<\/script>/gi,
            async (tag, before, _quote, src, after) => {
              const assetPath = localAssetPath(src, htmlPath, publicDirectory);
              if (!assetPath) {
                return tag;
              }

              const javascript = await fs.readFile(assetPath, 'utf8');
              const attributes = `${before}${after}`.trim();
              return `<script${attributes ? ` ${attributes}` : ''}>${javascript}</script>`;
            }
          );

          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, document);
          console.log(
            `Single-file HTML written to ${path.relative(process.cwd(), outputPath)}`
          );
        } catch (error) {
          result.errors.push({ text: `single-file-html: ${error.message}` });
        }
      });
    }
  };
}

module.exports = { singleFileHtmlPlugin };
