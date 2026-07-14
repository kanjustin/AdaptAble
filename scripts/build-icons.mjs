/**
 * Generates the extension toolbar/store icons from one SVG.
 * The AdaptAble mark: an orange 8-spoke asterisk on the ink square (matches the popup wordmark).
 * Run: npm run build:icons
 */
import sharp from 'sharp';
import fs from 'node:fs';

const spoke = (rot) => `<rect x="57" y="27" width="14" height="74" rx="7" transform="rotate(${rot} 64 64)"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#1b1a17"/>
  <g fill="#e8631a">${[0, 45, 90, 135].map(spoke).join('')}</g>
</svg>`;

fs.mkdirSync('adaptable/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`adaptable/icons/icon-${size}.png`);
  console.log(`wrote adaptable/icons/icon-${size}.png`);
}
