// Component-test config: jsdom environment, first-party Preact preset for
// JSX, and an alias that swaps the compile-time StyleX runtime for
// `test/stylex-stub.js`.
const path = require('node:path');
const preactModule = require('@preact/preset-vite');
const preact = preactModule.default || preactModule;

module.exports = {
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    // The Atlas fixture renders 514 SVG regions; role queries over that DOM
    // need more than Vitest's 5-second default on slower CI hosts.
    testTimeout: 15000
  },
  resolve: {
    alias: {
      '@stylexjs/stylex': path.resolve(__dirname, 'test/stylex-stub.js')
    }
  }
};
