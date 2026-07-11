/**
 * Dev-only: renders comis/popup.html as a static, script-free preview card so the
 * popup design can be viewed in a normal browser / artifact. Not shipped in the extension.
 * Usage: node scripts/build-popup-preview.mjs <outfile>
 */
import fs from 'node:fs';

const html = fs.readFileSync('comis/popup.html', 'utf8');
let style = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
// scope the popup's page-level `body` rule to the preview card
style = style.replace(/\n\s*body \{/, '\n  .pv-popup {');

let body = (html.match(/<body>([\s\S]*?)<\/body>/) || ['', ''])[1].replace(/<script[\s\S]*?<\/script>/g, '');

const CHIPS = `<div id="adaptations" class="chips">
  <div class="chip"><span class="name">Simplified page</span><button class="x">×</button></div>
  <div class="chip"><span class="name">Larger text</span><input type="range" min="0" max="1" step="0.05" value="0.7"><button class="x">×</button></div>
  <div class="chip"><span class="name">Dark mode</span><input type="range" min="0" max="1" step="0.05" value="1"><button class="x">×</button></div>
</div>`;
body = body.replace(/<div id="adaptations" class="chips">[\s\S]*?<\/span><\/div>/, CHIPS);
body = body.replace('<details id="traceBox">', '<details id="traceBox" open>');
body = body.replace('<div>Run a command to see how it was interpreted.</div>',
  `<div><b>You said: </b>“this page is overwhelming and the text is too small”</div>
   <div><b>Comis interpreted: </b>Simplified the page, Larger text.</div>
   <div><b>Interpreted by: </b><span class="pill local">Local parser</span></div>
   <div><b>Confidence: </b>90%</div>
   <div><b>Processing time: </b>7 ms</div>
   <div><b>Page contents sent externally: </b><span class="pill no">No</span></div>`);

const out = `<style>
  .pv-stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;gap:22px;flex-wrap:wrap;
    padding:34px 16px;background:#d9d6cd;background-image:radial-gradient(rgba(0,0,0,.07) 1px,transparent 1px);background-size:13px 13px;}
  .pv-cap{font-family:var(--mono);color:#6f6a5d;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin:6px 0 0;text-align:center}
  .pv-popup{border:2px solid #1b1a17;border-radius:14px;overflow:hidden;box-shadow:0 20px 55px rgba(0,0,0,.28);}
${style}
</style>
<div class="pv-stage">
  <div><div class="pv-popup">${body}</div><p class="pv-cap">Assist mode — 372px popup</p></div>
</div>`;

fs.writeFileSync(process.argv[2], out);
console.log('preview written to', process.argv[2]);
