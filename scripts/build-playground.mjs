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

const parser = fs.readFileSync('./extension/parser.js', 'utf8');
const simplify = fs.readFileSync('./extension/simplify.js', 'utf8');

const CONTENT = `
<header class="pnav">
  <span class="plogo">San Ramon Services</span>
  <nav>${['Home','Utilities','Permits','Transit','Health','Library','Parks','Police','Fire','Waste','Taxes','Jobs','Events','Contact','Login'].map(x => `<a href="#">${x}</a>`).join('')}</nav>
</header>
<div class="pticker"><span>Breaking: Library hours extended • Water bill due Friday • Flu shots available • Senior shuttle sign-ups open •</span></div>
<div class="playout">
  <aside class="pside"><h4>Related</h4><ul>${['Pay water bill','Report an outage','Trash schedule','Senior transport','Flu clinic','Pharmacy refills','Property tax','Jury duty'].map(x => `<li><a href="#">${x}</a></li>`).join('')}</ul></aside>
  <main>
    <article>
      <h1>How to Refill a Prescription and Pay Your Utility Bill Online</h1>
      <p>This guide explains, step by step, how residents can refill a prescription at the community pharmacy and pay a monthly utility bill without visiting an office in person. These services are available around the clock and are designed to be usable from a phone, tablet, or computer.</p>
      <div class="pactions"><button class="pbtn">Refill prescription</button><button class="pbtn">Pay utility bill</button><button class="pbtn sec">Schedule shuttle</button></div>
      <h2>Refilling a prescription</h2>
      <p>To refill a prescription, you will need the prescription number printed on the side of your medicine bottle. Enter that number, confirm your date of birth, and choose whether you want to pick the medication up or have it delivered. Most refills are ready within four hours.</p>
      <p>If you take several medications, you can enroll in synchronized refills so that all of your prescriptions are ready on the same day each month. This reduces the number of trips you need to make and makes it easier to keep track of what you have taken.</p>
      <h2>Paying a utility bill</h2>
      <p>To pay a utility bill, sign in with your account number and the last name on the account. You can pay a one-time amount, or set up automatic monthly payments. A receipt is emailed to you immediately, and your payment history is stored so you can review past bills at any time.</p>
      <p>If your bill is higher than usual, you can request a review or apply for the low-income assistance program directly from the same page. Payment plans are available for households that need to spread a large balance over several months.</p>
      <h2>Current service status</h2>
      <div class="pchart">
        <div class="pbar"><span class="psw" style="background:#22c55e"></span> Water portal — operating normally</div>
        <div class="pbar"><span class="psw" style="background:#ef4444"></span> Prescription delivery — delayed today</div>
        <div class="pbar"><span class="psw" style="background:#22c55e"></span> Senior shuttle — on schedule</div>
        <svg width="300" height="90" role="img" aria-label="Weekly uptime">
          <rect x="20" y="15" width="34" height="60" fill="#22c55e"></rect>
          <rect x="70" y="40" width="34" height="35" fill="#ef4444"></rect>
          <rect x="120" y="22" width="34" height="53" fill="#22c55e"></rect>
          <rect x="170" y="46" width="34" height="29" fill="#ef4444"></rect>
          <rect x="220" y="26" width="34" height="49" fill="#22c55e"></rect>
        </svg>
        <p style="font-size:11px">Green = up, red = down. (Color is the only cue here — a barrier for many users.)</p>
      </div>
    </article>
  </main>
  <aside class="pside"><h4>Sponsored</h4><p class="ppromo">Get 20% off home solar — click now!</p><h4>Weather</h4><p>Sunny, 78°F.</p><h4>Follow us</h4><ul>${['Facebook','Twitter / X','Instagram','Nextdoor'].map(x => `<li><a href="#">${x}</a></li>`).join('')}</ul></aside>
</div>
<div class="pcookie" id="pcookie">🍪 We use cookies to improve your experience.<button class="pbtn" onclick="this.parentElement.remove()">Accept</button></div>
<div class="ppopup" id="ppopup" role="dialog" aria-modal="true" aria-label="Newsletter"><div class="pbox"><button class="pclose" onclick="document.getElementById('ppopup').remove()">×</button><h3>📬 Don't miss out!</h3><p>Subscribe to the weekly newsletter.</p><button class="pbtn" style="width:100%" onclick="document.getElementById('ppopup').remove()">Subscribe</button></div></div>
`;

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
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef1f6}
  /* ---- cluttered demo content (this is what gets adapted) ---- */
  #vv-content{background:#fffdf5;color:#9a9a90;font-size:13px;line-height:1.35;min-height:100vh;padding-bottom:120px}
  #vv-content a{color:#a0a4b8}
  .pnav{background:#fef9e7;border-bottom:1px solid #f0e9cf;padding:8px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .plogo{font-weight:800;color:#c9a227;font-size:16px}
  .pnav nav{display:flex;flex-wrap:wrap;gap:8px;font-size:12px}.pnav nav a{text-decoration:none}
  .pticker{overflow:hidden;white-space:nowrap;background:#fff3cd;border-bottom:1px solid #f0e9cf}
  .pticker span{display:inline-block;padding:4px 0;animation:scroll 12s linear infinite}
  @keyframes scroll{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
  .playout{display:grid;grid-template-columns:170px 1fr 190px;gap:12px;padding:12px}
  .pside{background:#fef9e7;border:1px solid #f3ecd2;border-radius:6px;padding:10px;font-size:12px}
  .pside h4{margin:4px 0 6px;color:#b58e1f}.pside ul{margin:0;padding-left:15px}
  .ppromo{background:#fff3cd;padding:8px;border-radius:6px}
  main{background:#fffef9;border:1px solid #f3ecd2;border-radius:6px;padding:16px}
  article h1{color:#8a7a3a;font-size:21px;margin:0 0 6px}
  article h2{color:#97853f;font-size:15px;margin:16px 0 6px}article p{margin:10px 0}
  .pactions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
  .pbtn{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:9px 12px;font-weight:700;cursor:pointer;font-size:12px}
  .pbtn.sec{background:#e5e7eb;color:#374151}
  .psw{display:inline-block;width:42px;height:13px;border-radius:3px;vertical-align:middle}
  .pbar{margin:4px 0;font-size:12px}
  .pcookie{position:fixed;left:0;right:0;bottom:0;z-index:41;background:#1f2937;color:#e5e7eb;padding:11px 14px;display:flex;gap:12px;align-items:center;font-size:12px}
  .pcookie .pbtn{margin-left:auto}
  .ppopup{position:fixed;inset:0;z-index:42;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
  .ppopup .pbox{position:relative;background:#fff;color:#333;border-radius:10px;padding:20px;width:280px;text-align:center}
  .pclose{position:absolute;top:8px;right:10px;border:none;background:#eee;border-radius:999px;width:30px;height:30px;font-size:18px;cursor:pointer}
  .vv-reading{background:#fde68a!important;color:#111!important;box-shadow:0 0 0 4px #fde68a!important;border-radius:3px}
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
<div id="vv-content">${CONTENT}</div>

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
