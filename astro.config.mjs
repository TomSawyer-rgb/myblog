// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 磷光终端配色：关键字绿、字符串/数字琥珀、注释灰、默认浅灰
const termTheme = {
  name: 'terminal-phosphor',
  type: 'dark',
  colors: {
    'editor.background': '#0d0d0d',
    'editor.foreground': '#d7d7d7',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6f6f6f', fontStyle: 'italic' } },
    { scope: ['string', 'constant.numeric', 'constant.language'], settings: { foreground: '#d9a03a' } },
    { scope: ['keyword', 'storage', 'keyword.operator'], settings: { foreground: '#21c463' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#eaeaea' } },
    { scope: ['entity.name.type', 'support.type', 'support.class'], settings: { foreground: '#8fd6a5' } },
    { scope: ['variable', 'meta.definition.variable'], settings: { foreground: '#d7d7d7' } },
  ],
};

// https://astro.build/config
export default defineConfig({
  site: 'https://tomsawyer.fun',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: termTheme,
      wrap: true,
    },
  },
});
