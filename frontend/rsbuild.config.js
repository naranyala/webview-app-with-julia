// @ts-check
import { pluginOctane } from '@octanejs/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { pluginSingleFileHtml } from './scripts/single-file-html-plugin.js';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginOctane(), pluginTailwindcss(), pluginSingleFileHtml()],
});
