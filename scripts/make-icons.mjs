// Draws the app icon (orange wild-turkey track on near-black) and writes the PNGs the web app
// manifest needs. Colours come from the theme tokens. Run: node scripts/make-icons.mjs
// Uses the Playwright Chromium already in devDependencies to rasterize the SVG.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const css = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
const bg = token('bg');
const accent = token('accent');

// 512 x 512; the track stays inside the central 80 % circle so a maskable crop keeps it.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <g stroke="${accent}" stroke-width="34" stroke-linecap="round" fill="none">
    <path d="M256 330 L256 130"/>
    <path d="M256 330 L150 175"/>
    <path d="M256 330 L362 175"/>
    <path d="M256 330 L256 400"/>
  </g>
</svg>`;
writeFileSync(new URL('../public/icons/icon.svg', import.meta.url), `${svg}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512, 180]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}">`);
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: false });
}
await browser.close();
