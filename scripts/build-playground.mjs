/**
 * Generates public/playground.html — a zero-install, in-browser preview of the
 * VoiceVision Assist extension. It inlines the REAL extension/parser.js and
 * extension/simplify.js (so the parser + Simplify Page logic never diverge from the
 * shipped extension) plus a compact engine that mirrors content.js's transforms,
 * scoped to #vv-content so the control panel itself isn't transformed.
 *
 * Run: npm run build:playground
 */
import fs from 'node:fs';
import { STYLES, CONTENT } from './demo-content.mjs';

const parser = fs.readFileSync('./extension/parser.js', 'utf8');
const simplify = fs.readFileSync('./extension/simplify.js', 'utf8');

const ENGINE = String.raw`
(function () {
  const content = document.getElementById('vv-content');
  const KEYS = ['textScale','lineSpacing','letterSpacing','paraSpacing','boldText','highContrast','darkMode','dimOverlay','warmTone','reduceMotion','focusHighlight','simplify','reposition','colorDistinction'];
  const def = () => ({ textScale:null,lineSpacing:null,letterSpacing:null,paraSpacing:null,boldText:false,highContrast:false,darkMode:false,dimOverlay:false,warmTone:false,reduceMotion:false,focusHighlight:false,simplify:false,reposition:null,colorDistinction:false });
  let state = def(); const undo = [];

  const buildFilter = (s) => { const p=[]; if(s.darkMode)p.push('invert(0.92) hue-rotate(180deg)'); if(s.warmTone)p.push('sepia(0.3)'); if(s.highContrast)p.push('contrast(1.4)'); if(s.colorDistinction)p.push('saturate(1.5) contrast(1.08)'); return p.join(' ')||'none'; };
  const styleText = (s) => { const r=[]; if(s.lineSpacing)r.push('#vv-content :where(p,li,dd,blockquote,td){line-height:'+s.lineSpacing+'!important}'); if(s.letterSpacing)r.push('#vv-content :where(p,li,a,span,h1,h2,h3){letter-spacing:'+s.letterSpacing+'em!important}'); if(s.paraSpacing)r.push('#vv-content :where(p,li){margin-block:'+s.paraSpacing+'em!important}'); if(s.boldText)r.push('#vv-content :where(p,li,a,span,h1,h2,h3,button){font-weight:600!important}'); if(s.reduceMotion)r.push('#vv-content *,#vv-content *::before,#vv-content *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}'); if(s.focusHighlight)r.push('#vv-content :where(p,li,h1,h2,h3):hover{background:rgba(37,99,235,.14)!important;border-radius:4px}'); if(s.colorDistinction)r.push('#vv-content a{text-decoration:underline!important}#vv-content button{outline:1.5px solid rgba(0,0,0,.45)!important}'); return r.join('\n'); };
  const setStyle = (id, css) => { let el=document.getElementById(id); if(!css){el&&el.remove();return;} if(!el){el=document.createElement('style');el.id=id;document.head.appendChild(el);} el.textContent=css; };
  const dim = (on) => { let o=document.getElementById('vv-pg-dim'); if(!on){o&&o.remove();return;} if(!o){o=document.createElement('div');o.id='vv-pg-dim';o.style.cssText='position:fixed;inset:0;background:#000;opacity:.42;pointer-events:none;z-index:40';document.body.appendChild(o);} };
  const repos = (dir) => { const main=(window.__VV_SIMPLIFY&&window.__VV_SIMPLIFY.getContentNode())||content; content.querySelectorAll('[data-vv-repos]').forEach(e=>e.removeAttribute('data-vv-repos')); if(!dir||dir==='center'){setStyle('vv-pg-repos','');return;} main.setAttribute&&main.setAttribute('data-vv-repos',''); const side=dir==='right'?'margin-left:auto!important;margin-right:2vw!important':'margin-right:auto!important;margin-left:2vw!important'; setStyle('vv-pg-repos','[data-vv-repos]{max-width:60%!important;float:none!important;'+side+'}'); };

  function applyAll() {
    content.style.filter = buildFilter(state);
    content.style.zoom = state.textScale && state.textScale>1 ? state.textScale : '';
    setStyle('vv-pg-style', styleText(state));
    dim(state.dimOverlay); repos(state.reposition);
    if (state.simplify) { if(!window.__VV_SIMPLIFY.isActive()) window.__VV_SIMPLIFY.apply(); }
    else window.__VV_SIMPLIFY.teardown();
  }
  function reset() { stopRead(); window.__VV_SIMPLIFY.teardown(); state=def(); undo.length=0; content.style.filter='none'; content.style.zoom=''; setStyle('vv-pg-style',''); setStyle('vv-pg-repos',''); dim(false); content.querySelectorAll('[data-vv-repos]').forEach(e=>e.removeAttribute('data-vv-repos')); render(); }
  function applyCmd(cmd) { if(!cmd)return; if(cmd.reset){reset();return;} if(cmd.undo){ if(undo.length){state=JSON.parse(undo.pop());applyAll();render();} return;} if(cmd.readAloud){ cmd.readAloud==='start'?startRead():stopRead(); return;} undo.push(JSON.stringify(state)); for(const k of KEYS){const v=cmd[k]; if(v==null)continue; if(k==='reposition'&&v==='center'){state[k]=null;continue;} state[k]=v;} applyAll(); render(); }

  // ---- read aloud ----
  let reading=false;
  function startRead(){ if(!('speechSynthesis'in window))return; stopRead(); const root=(window.__VV_SIMPLIFY&&window.__VV_SIMPLIFY.getContentNode())||content; const els=[...root.querySelectorAll('h1,h2,h3,p,li')].filter(e=>!e.closest('[data-vv-hide]')&&e.textContent.trim().length>2); let i=0; reading=true; const next=()=>{ if(!reading||i>=els.length){stopRead();return;} const el=els[i]; document.querySelectorAll('.vv-reading').forEach(x=>x.classList.remove('vv-reading')); el.classList.add('vv-reading'); el.scrollIntoView({block:'center',behavior:'smooth'}); const u=new SpeechSynthesisUtterance(el.textContent.trim()); u.onend=()=>{i++;next();}; u.onerror=()=>{i++;next();}; speechSynthesis.speak(u); }; next(); }
  function stopRead(){ reading=false; if('speechSynthesis'in window)speechSynthesis.cancel(); document.querySelectorAll('.vv-reading').forEach(x=>x.classList.remove('vv-reading')); }

  // ---- panel wiring ----
  const $=id=>document.getElementById(id);
  function active(){ const a=[]; if(state.simplify)a.push('Simplified'); if(state.textScale>1)a.push('Larger text'); if(state.lineSpacing)a.push('More spacing'); if(state.boldText)a.push('Bold'); if(state.highContrast)a.push('High contrast'); if(state.darkMode)a.push('Dark'); if(state.dimOverlay)a.push('Dimmed'); if(state.warmTone)a.push('Warm'); if(state.reduceMotion)a.push('Less motion'); if(state.focusHighlight)a.push('Focus'); if(state.colorDistinction)a.push('Color distinction'); if(state.reposition)a.push('Content '+state.reposition); return a; }
  function render(){ const a=active(); $('pg-active').textContent = a.length? a.join(' · ') : 'None yet — try a command or a quick action.'; $('pg-undo').disabled = undo.length===0; }
  function run(text){ const r=window.VVParser.parse(text, state); $('pg-said').textContent = text? '“'+text+'”' : ''; if(r.status==='refused'){$('pg-trace').textContent='🛡️ '+r.explanation; return;} if(r.status==='unsupported'){$('pg-trace').textContent=r.explanation; return;} if(r.status==='empty'){$('pg-trace').textContent='Type a request.'; return;} if(r.status==='needs_api'){$('pg-trace').textContent='“'+text+'” is ambiguous — in the extension this goes to Gemini (structured intent only). Try e.g. “make the text bigger”.'; return;} applyCmd(r.command); $('pg-trace').innerHTML = r.explanation + ' &nbsp;<span class="pg-pill">Local parser · '+Math.round(r.confidence*100)+'% · no page content sent</span>'; }

  document.querySelectorAll('#vv-panel [data-cmd]').forEach(b=>b.addEventListener('click',()=>run(b.getAttribute('data-cmd'))));
  $('pg-apply').addEventListener('click',()=>{run($('pg-input').value); $('pg-input').value='';});
  $('pg-input').addEventListener('keydown',e=>{if(e.key==='Enter'){run($('pg-input').value); $('pg-input').value='';}});
  $('pg-undo').addEventListener('click',()=>applyCmd({undo:true}));
  $('pg-reset').addEventListener('click',()=>{reset();$('pg-trace').textContent='Page reset to normal.';$('pg-said').textContent='';});
  render();
})();
`;

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>VoiceVision Assist — Browser Playground</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:'Amazon Ember',Arial,Helvetica,sans-serif;background:#e3e6e6}
  /* ---- cluttered demo content (this is what gets adapted; styles shared with demo.html) ---- */
  #vv-content{min-height:100vh}
${STYLES}
  /* ---- control panel (NOT transformed; id starts with vv- so Simplify skips it) ---- */
  #vv-panel{position:fixed;top:16px;right:16px;width:300px;max-height:calc(100vh - 32px);overflow:auto;z-index:2147483000;background:#0f1117;color:#f3f5f9;border-radius:16px;box-shadow:0 12px 50px rgba(0,0,0,.5);padding:16px;font-size:13px}
  #vv-panel h2{margin:0 0 2px;font-size:16px;font-weight:800}#vv-panel h2 span{color:#4f8cff}
  #vv-panel .sub{color:#9aa6bd;font-size:11px;margin:0 0 12px}
  .pg-bar{display:flex;gap:6px}
  #pg-input{flex:1;min-width:0;background:#1b2130;border:1px solid #313a4f;color:#f3f5f9;border-radius:10px;padding:9px 11px;font-size:13px}
  #pg-apply{border:none;border-radius:10px;background:#3b82f6;color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
  .pg-said{margin:8px 0 0;font-size:12px;color:#cfd6e6;min-height:15px}
  .pg-trace{margin:6px 0 0;font-size:12px;color:#9aa6bd;min-height:16px;line-height:1.5}
  .pg-pill{display:inline-block;background:#10331f;color:#7ee2a8;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700}
  .pg-label{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9aa6bd;font-weight:700;margin:12px 0 6px}
  .pg-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .pg-qa{padding:9px 8px;border:1px solid #313a4f;background:#1b2130;color:#f3f5f9;border-radius:9px;cursor:pointer;font-size:12px;font-weight:600;text-align:left}
  .pg-qa:hover{background:#232b3d;border-color:#3b82f6}
  .pg-qa.wide{grid-column:1/-1}.pg-qa.primary{background:#3b82f6;border-color:#3b82f6;color:#fff}
  .pg-active{margin:8px 0 0;font-size:12px;color:#cfd6e6;background:#1b2130;border:1px solid #313a4f;border-radius:9px;padding:8px 10px;min-height:16px}
  .pg-row{display:flex;gap:6px;margin-top:8px}.pg-row .pg-qa{flex:1;text-align:center}
  #pg-undo:disabled{opacity:.5;cursor:default}
</style></head>
<body>
<div id="vv-content" class="az-page">${CONTENT}</div>

<div id="vv-panel">
  <h2>Voice<span>Vision</span> Assist</h2>
  <p class="sub">Browser playground — real parser &amp; Simplify engine from the extension.</p>
  <div class="pg-bar">
    <input id="pg-input" type="text" placeholder="Say what's hard… e.g. this is too small"/>
    <button id="pg-apply">Apply</button>
  </div>
  <p class="pg-said" id="pg-said"></p>
  <p class="pg-trace" id="pg-trace">Try a quick action, or type a request.</p>
  <div class="pg-label">Quick actions</div>
  <div class="pg-grid">
    <button class="pg-qa primary wide" data-cmd="simplify this page">✨ Simplify this page</button>
    <button class="pg-qa" data-cmd="make the text bigger">🔠 Larger text</button>
    <button class="pg-qa" data-cmd="increase the spacing">↕ More spacing</button>
    <button class="pg-qa" data-cmd="high contrast">◐ High contrast</button>
    <button class="pg-qa" data-cmd="dark mode">🌙 Dark mode</button>
    <button class="pg-qa" data-cmd="the page is too bright">🔅 Dim it</button>
    <button class="pg-qa" data-cmd="warm colors">🔥 Warm colors</button>
    <button class="pg-qa" data-cmd="stop all animations">🚫 Less motion</button>
    <button class="pg-qa" data-cmd="help me focus">🎯 Focus</button>
    <button class="pg-qa" data-cmd="improve color distinction">🎨 Color distinction</button>
    <button class="pg-qa" data-cmd="move the important content to the right">➡ Move right</button>
    <button class="pg-qa" data-cmd="read the main content aloud">🔊 Read aloud</button>
  </div>
  <div class="pg-label">Active adaptations</div>
  <div class="pg-active" id="pg-active">None yet.</div>
  <div class="pg-row">
    <button class="pg-qa" id="pg-undo">↩ Undo</button>
    <button class="pg-qa" id="pg-reset">⟲ Reset</button>
  </div>
</div>

<script>/* --- real extension/parser.js --- */
${parser}
</script>
<script>/* --- real extension/simplify.js --- */
${simplify}
</script>
<script>/* --- compact preview engine (mirrors content.js, scoped to #vv-content) --- */
${ENGINE}
</script>
</body></html>`;

fs.writeFileSync('./public/playground.html', html);
console.log('Wrote public/playground.html (' + (html.length / 1024).toFixed(1) + ' KB)');
