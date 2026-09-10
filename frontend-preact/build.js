const esbuild = require('esbuild');
const stylex = require('@stylexjs/unplugin');
const { singleFileHtmlPlugin } = require('./plugins/single-file-html');

const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');

async function build() {
  const context = await esbuild.context({
    entryPoints: ['src/main.jsx'],
    bundle: true,
    outfile: 'public/assets/app.js',
    sourcemap: watch,
    jsx: 'automatic',
    jsxImportSource: 'preact',
    metafile: true,
    plugins: [
      stylex.esbuild({
        useCSSLayers: true,
        importSources: ['@stylexjs/stylex'],
        unstable_moduleResolution: { type: 'commonJS', rootDir: __dirname }
      }),
      singleFileHtmlPlugin()
    ],
    loader: {
      '.css': 'css',
      '.png': 'dataurl'
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        watch ? 'development' : 'production'
      )
    },
    minify: !watch,
    logLevel: 'info'
  });

  if (watch) {
    await context.watch();
    console.log('Watching for changes...');
  } else if (!serve) {
    await context.rebuild();
    await context.dispose();
  } else {
    await context.rebuild();
  }

  if (serve) {
    const server = await context.serve({
      servedir: 'public',
      port: 3000
    });

    console.log(`Serving http://${server.hosts[0]}:${server.port}`);
  }
}

build().catch(() => process.exit(1));
