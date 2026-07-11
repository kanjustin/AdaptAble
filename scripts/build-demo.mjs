/**
 * Generates public/demo.html (the extension's cluttered test page) from the shared
 * demo content. Run: npm run build:demo
 */
import fs from 'node:fs';
import { STYLES, CONTENT } from './demo-content.mjs';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ShopEasy — Blood Pressure Monitor (VoiceVision demo page)</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:'Amazon Ember',Arial,Helvetica,sans-serif}
${STYLES}
</style>
</head>
<body>
<div class="az-page">
${CONTENT}
</div>
</body>
</html>
`;

fs.writeFileSync('./public/demo.html', html);
console.log('Wrote public/demo.html (' + (html.length / 1024).toFixed(1) + ' KB)');
