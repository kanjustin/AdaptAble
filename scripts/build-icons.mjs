/**
 * Generates the extension toolbar/store icons from one SVG.
 * A voice "waveform" mark in the Comis blue on the popup's dark navy.
 * Run: npm run build:icons
 */
import sharp from 'sharp';
import fs from 'node:fs';

const bars = [
  { x: 23, h: 28 }, { x: 41, h: 52 }, { x: 59, h: 74 }, { x: 77, h: 52 }, { x: 95, h: 28 },
]
  .map(({ x, h }) => `<rect x="${x}" y="${(128 - h) / 2}" width="10" height="${h}" rx="5"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5b9bff"/><stop offset="1" stop-color="#2f6bff"/>
  </linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="#0f1117"/>
  <rect x="3" y="3" width="122" height="122" rx="26" fill="none" stroke="#2a3450" stroke-width="2"/>
  <g fill="url(#g)">${bars}</g>
</svg>`;

fs.mkdirSync('comis/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`comis/icons/icon-${size}.png`);
  console.log(`wrote comis/icons/icon-${size}.png`);
}
