/**
 * AdaptAble — Local deterministic command parser (Assist Mode).
 *
 * This is the PRIMARY interpretation path. It runs instantly, offline, with zero
 * network calls, and covers the common accessibility commands. Only when it is not
 * confident does the caller fall back to the Gemini API.
 *
 * IMPORTANT (product correction): in Assist Mode, symptom language like "I can't tell
 * red from green" maps to color-DISTINCTION assistance — NOT to a colour-blindness
 * *simulation*. Simulations live in a separate Developer Simulation Mode and are only
 * triggered by explicit phrasing ("simulate deuteranopia").
 *
 * Shipped as a UMD module so the exact same code runs in the extension popup
 * (window.VVParser) and in the Node evaluation harness (require('./parser.js')).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VVParser = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Command vocabulary -------------------------------------------------
  // The command mirrors the applied state keys so the content script can merge it
  // directly. Assist keys are additive to the original simulation-era keys.
  function emptyCommand() {
    return {
      // assist — readability
      textScale: null, // number 1.0–2.5 (null = no change)
      lineSpacing: null, // number 1.4–2.4
      letterSpacing: null, // number 0–0.12 (em)
      paraSpacing: null, // number 0–2.5 (em)
      boldText: null, // boolean
      // assist — visual comfort
      highContrast: null, // boolean
      darkMode: null, // boolean
      dimOverlay: null, // boolean ("too bright")
      warmTone: null, // boolean (reduce blue light)
      reduceMotion: null, // boolean
      // assist — focus / structure
      focusHighlight: null, // boolean
      simplify: null, // boolean (Simplify Page)
      reposition: null, // 'left' | 'right' | 'center'
      colorDistinction: null, // boolean (assist, NOT a simulation)
      readAloud: null, // 'start' | 'stop'
      // find & guide — locate content/controls on the page (searched locally)
      find: null, // string: what to find/highlight/scroll to
      // developer simulation mode (explicit requests only)
      colorMode: null, // 'deuteranopia'|'protanopia'|'tritanopia'|'achromatopsia'
      hemianopia: null, // 'left'|'right'
      zoom: null, // 'center'|'peripheral'|'full'
      blur: null, // boolean (cataract simulation)
      // relative-intensity nudges reuse the existing intensities map
      intensities: null,
      brightness: null,
      // control
      undo: false,
      reset: false,
      // meta (never applied to the DOM)
      confidence: 0,
      explanation: '',
    };
  }

  // Off-value for each feature, used by negation ("turn off X") and validation.
  const OFF_VALUE = {
    textScale: null, lineSpacing: null, letterSpacing: null, paraSpacing: null,
    boldText: false, highContrast: false, darkMode: false, dimOverlay: false,
    warmTone: false, reduceMotion: false, focusHighlight: false, simplify: false,
    reposition: null, colorDistinction: false, colorMode: null, hemianopia: null,
    zoom: null, blur: null,
  };

  // ---- Normalisation ------------------------------------------------------
  // Small, honest ASR/typo fixups. We deliberately keep this list short — broad
  // substring matching in the rules handles most variation without a fuzzy layer.
  const FIXUPS = [
    [/\bcolor ?blind(ness)?\b/g, 'colorblind'],
    [/\bcollor/g, 'color'],
    [/\bread a ?loud\b/g, 'read aloud'],
    [/\bzoomin\b/g, 'zoom in'],
    [/\bto (small|big|bright|dark|light)\b/g, 'too $1'],
    [/\bmigrane\b/g, 'migraine'],
    [/\banimation\b/g, 'animations'],
  ];

  function normalize(text) {
    let t = String(text || '').toLowerCase();
    for (const [re, sub] of FIXUPS) t = t.replace(re, sub);
    t = t.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }

  // ---- Safety: prompt-injection / unsafe requests -------------------------
  const INJECTION = /(ignore (all |your )?(previous|prior)|system prompt|reveal (your|the) (prompt|instructions|api key)|run (javascript|js|code|this|a|the)?\s*script|run (javascript|js|code)|\balert\s*\(|eval\s*\(|<script|drop table|jailbreak|\bsudo\b|api[\s_-]?key|execute (code|the following|this))/i;

  // Words that signal the request is at least *about* using/reading the page —
  // used to decide "ambiguous accessibility → ask the AI" vs "not our job".
  const ACCESSIBILITY_HINT = /(see|read|color|colour|text|letter|word|page|screen|eye|eyes|vision|visual|bright|dark|dim|light|contrast|focus|move|motion|animation|blur|zoom|big|small|font|glare|hurt|strain|clutter|busy|overwhelm|simpl)/i;

  // ---- Numeric step helpers ----------------------------------------------
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function stepUp(current, base, step, max) {
    const c = current == null ? base - step : current;
    return Number(clamp(c + step, base, max).toFixed(3));
  }
  function stepDown(current, base, step, min, defaultOff) {
    if (current == null) return defaultOff; // already off
    const next = Number((current - step).toFixed(3));
    return next <= min ? defaultOff : Number(clamp(next, min, base + 10).toFixed(3));
  }

  // ---- Rule set -----------------------------------------------------------
  // Each rule: id, category, a matcher (RegExp or predicate), and an apply(cmd, state).
  // Rules are evaluated in order; multiple can fire (compound commands).
  const RULES = [
    // ---- Control (checked first, short-circuits) ----
    {
      id: 'reset', category: 'reset',
      match: /\b(reset|start over|clear (everything|all|it)|turn everything off|remove all|back to (normal|default)|restore the page|undo everything)\b/,
      control: true,
      apply: (c) => { c.reset = true; },
    },
    {
      id: 'undo', category: 'reset',
      match: /\b(undo( that| the last( change)?)?|go back|revert|take that back|never mind that)\b/,
      control: true,
      apply: (c) => { c.undo = true; },
    },

    // ---- Negation / removal. `negation: true` defers it until AFTER the positive
    // rules so "turn off dark mode" overrides the "dark mode" match. Triggers are
    // kept tight ("turn off"/"disable") so they don't collide with positive intents
    // like "stop animations" (reduce motion) or "remove the clutter" (simplify).
    {
      id: 'turn-off', category: 'negation', negation: true,
      match: /\b(turn off|turn .{1,20} off|disable|switch off)\b/,
      apply: (c, s, t) => { applyNegation(c, t); },
    },

    // ---- Read aloud ----
    { id: 'read-stop', category: 'read', match: /\b(stop (reading|talking|the voice|speaking)|be quiet|quiet|shut up|stop reading)\b/, apply: (c) => { c.readAloud = 'stop'; } },
    // Require an explicit read-aloud signal so "can't read this" does NOT trigger it.
    { id: 'read-start', category: 'read', match: /\b(read\b.{0,25}\b(aloud|out loud|to me)|read (me )?the (important|main) (part|bit|content)|read aloud|speak the (page|text)|say the words)/, apply: (c) => { c.readAloud = 'start'; } },

    // ---- Find & guide: locate content/controls on the page ----
    {
      id: 'find', category: 'find',
      match: /\b(find( me)?|locate|look for|where(?:'?s| is| are| do i| can i| would i| to)?|show me|take me to|jump to|scroll to|highlight|search for|point me to)\b/,
      apply: (c, s, t) => { const q = extractFindQuery(t); if (q && q.length >= 2) c.find = q; },
    },

    // ---- Simplify page (the centerpiece) ----
    {
      id: 'simplify', category: 'simplify',
      match: /\b(simplif|too (much|busy|cluttered)|too much going on|overwhelm|clutter|declutter|distracting|reader mode|clean( it| this)? up|just (the )?(important|main)|show (me )?only|remove the (ads|clutter|distractions)|focus on the (content|article|text)|easier (for .{1,30} )?to read|easier to (read|focus on)|make .{1,20} readable|hard to read this page)/,
      apply: (c) => { c.simplify = true; },
    },

    // ---- Text size ----
    { id: 'text-smaller', category: 'text', match: /\b(smaller|too big|text is huge|shrink|reduce (the )?(text|font)|zoom out|less zoom)\b/, apply: (c, s) => { c.textScale = stepDown(s && s.textScale, 1.5, 0.25, 1.0, 1.0); } },
    { id: 'text-bigger', category: 'text', match: /\b(bigger|larger|too small|tiny|can'?t read|hard to read|enlarge|increase (the )?(text|font|size)|make (everything|it|the text|things) bigger|text is small|letters are (tiny|small)|zoom in|magnif|need (it|everything) bigger)/, apply: (c, s) => { c.textScale = stepUp(s && s.textScale, 1.25, 0.25, 2.5); } },

    // ---- Spacing ----
    { id: 'line-spacing', category: 'spacing', match: /\b(line spacing|space between (the )?lines|lines (are )?too close|lines cramped|spread (out )?the lines( out)?|spread out the lines|double spac|(more|increase|add|extra|the) (the )?spacing|increase (the )?spacing)/, apply: (c, s) => { c.lineSpacing = stepUp(s && s.lineSpacing, 1.8, 0.3, 2.4); } },
    { id: 'letter-spacing', category: 'spacing', match: /\b(letter spacing|space between (the )?letters|letters (are )?too close|letters cramped)\b/, apply: (c, s) => { c.letterSpacing = stepUp(s && s.letterSpacing, 0.06, 0.03, 0.12); } },
    { id: 'para-spacing', category: 'spacing', match: /\b(paragraph spacing|space between paragraphs|paragraphs (are )?too close)\b/, apply: (c, s) => { c.paraSpacing = stepUp(s && s.paraSpacing, 1.2, 0.6, 2.5); } },
    { id: 'bold-text', category: 'text', match: /\b(bold(er)? text|thicker text|make the text bold|letters look thin|text is (too )?thin|heavier text)\b/, apply: (c) => { c.boldText = true; } },

    // ---- Contrast ----
    { id: 'contrast-less', category: 'contrast', match: /\b(less contrast|too much contrast|contrast is too (high|strong))\b/, apply: (c, s) => { adjustIntensity(c, s, 'highContrast', -0.2, 'highContrast'); } },
    { id: 'contrast-more', category: 'contrast', match: /\b(high contrast|more contrast|higher contrast|increase (the )?contrast|low contrast|washed out|faded|text is (faint|too light|hard to see)|colou?rs? (are )?(dull|washed))/, apply: (c, s) => { c.highContrast = true; if (s && s.highContrast) adjustIntensity(c, s, 'highContrast', 0.2, 'highContrast'); } },

    // ---- Brightness / dim ("too bright") ----
    { id: 'dim', category: 'brightness', match: /\b(too bright|page is (too )?bright|screen is (blinding|too bright)|the white hurts|white hurts my eyes|bright white|dim (it|the (page|screen|bright|colou?rs?|lights))|dim the|dimmer|make it dimmer|lower (the )?brightness|less bright|tone down the (glare|brightness|bright)|reduce (the )?glare|it'?s too bright|to bright)/, apply: (c, s) => { c.dimOverlay = true; if (s && s.dimOverlay) adjustIntensity(c, s, 'dimOverlay', 0.15, 'dimOverlay'); } },
    { id: 'dim-less', category: 'brightness', match: /\b(a little less (bright|dim)|less dim|not so dark|too dim|brighten (it|the page) up)\b/, apply: (c, s) => { adjustIntensity(c, s, 'dimOverlay', -0.15, 'dimOverlay'); } },

    // ---- Dark mode ---- (no trailing \b so "make it darker" matches "make it dark")
    { id: 'dark-on', category: 'dark', match: /\b(dark mode|make it dark|too white|switch to dark|darken the page|night mode)/, apply: (c) => { c.darkMode = true; } },

    // ---- Warm ----
    { id: 'warm', category: 'warm', match: /\b(warm(er)?( it up| tone| colou?rs?)?|reduce (the )?blue light|blue light|less blue|yellow tint|easier on (my|the) eyes at night)\b/, apply: (c) => { c.warmTone = true; } },

    // ---- Reduce motion ----
    { id: 'reduce-motion', category: 'motion', match: /\b(stop (all )?(the )?(animation|animations|movement|moving|motion)|reduce (the )?motion|too much (movement|motion)|things (are )?moving|(page|it) (keeps|is) moving|keeps moving|stop the page from moving|animations? (make me|are) (dizzy|distracting|annoying)|motion sick|makes me dizzy|flashing|blinking)/, apply: (c) => { c.reduceMotion = true; } },

    // ---- Focus / place-keeping ----
    { id: 'focus', category: 'focus', match: /\b(help me focus|hard to focus|keep losing (my|where) (place|i am)|losing my place|highlight where i am|can'?t keep my place|focus (highlight|assist)|show me i(')?m reading)\b/, apply: (c) => { c.focusHighlight = true; } },

    // ---- Color distinction (ASSIST — never a simulation here) ----
    { id: 'color-distinction', category: 'color', match: /\b(can'?t (tell|distinguish|see the difference between)|distinguish (the )?colou?rs?|tell (them |these )?colou?rs? apart|colou?rs? (all )?look (the same|alike)|red (and|from|vs) green|hard to tell (the )?colou?rs?|colou?rblind|colou?r blind|improve colou?r distinction|help (me )?(with|tell) colou?rs?|colou?r distinction)/, apply: (c) => { c.colorDistinction = true; } },

    // ---- Content repositioning ----
    { id: 'move-right', category: 'reposition', match: /\b(move (the )?(important |main |primary )?(content|text|article|it) (to the )?right|content on (the|my) right|shift (the )?(content|text|it) (to the )?right|trouble seeing the left|keep (the )?controls on (my|the) right|hard to see (the )?left side)/, apply: (c) => { c.reposition = 'right'; } },
    { id: 'move-left', category: 'reposition', match: /\b(move (the )?(important |main |primary )?(content|text|article|it) (to the )?left|content on (the|my) left|shift (the )?(content|text|it) (to the )?left|trouble seeing the right|hard to see (the )?right side)/, apply: (c) => { c.reposition = 'left'; } },
    { id: 'move-center', category: 'reposition', match: /\b(center the (content|text|page)|move (it|the content) (back to )?(the )?(middle|center))/, apply: (c) => { c.reposition = 'center'; } },

    // ---- Developer Simulation Mode (explicit only) ----
    { id: 'sim-deuter', category: 'simulation', match: /\b(simulate|show me|preview) (deuteranopia|red-?green (colou?r ?)?blindness)|deuteranopia simulation\b/, apply: (c) => { c.colorMode = 'deuteranopia'; } },
    { id: 'sim-protan', category: 'simulation', match: /\b(simulate|show me|preview) protanopia|protanopia simulation\b/, apply: (c) => { c.colorMode = 'protanopia'; } },
    { id: 'sim-tritan', category: 'simulation', match: /\b(simulate|show me|preview) tritanopia|tritanopia simulation\b/, apply: (c) => { c.colorMode = 'tritanopia'; } },
    { id: 'sim-achroma', category: 'simulation', match: /\b(simulate|show me|preview) (achromatopsia|grayscale|greyscale|total colou?r blindness)\b/, apply: (c) => { c.colorMode = 'achromatopsia'; } },
  ];

  // Feature keyword table for negation ("turn off dark mode").
  const FEATURE_WORDS = [
    ['simplify', /\b(simplif|reader mode|declutter)\b/],
    ['darkMode', /\bdark( mode)?\b/],
    ['dimOverlay', /\b(dim(mer|ming)?|dimming)\b/],
    ['warmTone', /\bwarm( tone| colou?rs?)?|blue light\b/],
    ['highContrast', /\bcontrast\b/],
    ['reduceMotion', /\b(motion|animations?)\b/],
    ['boldText', /\bbold( text)?\b/],
    ['focusHighlight', /\bfocus( highlight| assist)?\b/],
    ['colorDistinction', /\bcolou?r (distinction|help|assist)\b/],
    ['reposition', /\b(reposition|move|centering)\b/],
    ['textScale', /\b(text size|bigger text|larger text|zoom|magnif)\b/],
    ['lineSpacing', /\bline spacing\b/],
    ['colorMode', /\b(simulation|deuteranopia|protanopia|tritanopia|achromatopsia)\b/],
    ['readAloud', /\b(reading|read aloud|voice)\b/],
  ];

  function applyNegation(cmd, t) {
    for (const [key, re] of FEATURE_WORDS) {
      if (re.test(t)) {
        if (key === 'readAloud') cmd.readAloud = 'stop';
        else cmd[key] = OFF_VALUE[key];
        return;
      }
    }
    // "turn off the filters" / "stop everything" with no specific feature → reset.
    cmd.reset = true;
  }

  // Pull the search phrase out of a "find X" / "where is X" style request.
  function extractFindQuery(t) {
    const m = t.match(/\b(find me|find|locate|look for|where(?:'?s| is| are| do i| can i| would i| to)?|show me|take me to|jump to|scroll to|highlight|search for|point me to)\b\s*(.*)$/);
    let q = (m ? m[2] : t) || '';
    q = q.replace(/^(the|a|an|my|to|for|me|is|are|it|that|about)\s+/i, '')
         .replace(/\bon (the|this) page\b/gi, '')
         .replace(/[?.!]+$/, '')
         .trim();
    return q;
  }

  function adjustIntensity(cmd, state, key, delta, intensityKey) {
    const cur = (state && state.intensities && state.intensities[intensityKey]);
    const base = cur == null ? 0.5 : cur;
    const next = Number(clamp(base + delta, 0, 1).toFixed(2));
    cmd.intensities = Object.assign({}, cmd.intensities, { [intensityKey]: next });
  }

  // Whether an applied command actually changes anything. Defaults are `null`
  // (untouched); an explicit `false` means "turn this feature off" — a real change.
  function isEmptyCommand(cmd) {
    if (cmd.reset || cmd.undo) return false;
    for (const k of Object.keys(cmd)) {
      if (k === 'reset' || k === 'undo' || k === 'confidence' || k === 'explanation') continue;
      const v = cmd[k];
      if (v !== null && v !== undefined) return false;
    }
    return true;
  }

  // ---- Deterministic explanation -----------------------------------------
  // Generated from the validated command, never from free-form model text.
  const LABELS = {
    simplify: 'Made the text easier to read',
    textScale: 'Larger text',
    lineSpacing: 'More line spacing',
    letterSpacing: 'More letter spacing',
    paraSpacing: 'More paragraph spacing',
    boldText: 'Bolder text',
    highContrast: 'Higher contrast',
    darkMode: 'Dark mode',
    dimOverlay: 'Dimmed the page',
    warmTone: 'Warmer colors',
    reduceMotion: 'Stopped animations',
    focusHighlight: 'Focus highlighting',
    reposition: 'Moved the content',
    colorDistinction: 'Color distinction assistance',
    colorMode: 'Simulation',
    hemianopia: 'Simulation',
    zoom: 'Magnified',
    blur: 'Cataract simulation',
  };

  function describe(cmd) {
    if (cmd.reset) return 'Reset the page to normal.';
    if (cmd.undo) return 'Undid the last change.';
    if (cmd.readAloud === 'start') return 'Reading the main content aloud.';
    if (cmd.readAloud === 'stop') return 'Stopped reading.';
    if (cmd.find) return 'Finding “' + cmd.find + '” on the page.';
    const on = [];
    const off = [];
    for (const key of Object.keys(LABELS)) {
      const v = cmd[key];
      if (v === null || v === undefined) continue;
      // Numeric "off" sentinels: textScale 1.0 (no scaling), spacings 0.
      const isOff = v === false || v === 0 || (key === 'textScale' && v <= 1.0);
      if (isOff) off.push(LABELS[key]);
      else on.push(LABELS[key]);
    }
    const parts = [];
    if (on.length) parts.push(on.join(', '));
    if (off.length) parts.push('turned off ' + off.join(', '));
    const s = parts.join('; ');
    return (s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : 'No change.').slice(0, 200);
  }

  // ---- Main entry ---------------------------------------------------------
  /**
   * @param {string} transcript raw user text or speech transcript
   * @param {object} [state] current applied state (for relative commands)
   * @returns {{command: object|null, source: 'local', confidence: number,
   *            status: 'ok'|'needs_api'|'unsupported'|'refused'|'empty',
   *            matched: string[], explanation: string}}
   */
  function parse(transcript, state) {
    const raw = String(transcript == null ? '' : transcript);
    if (!raw.trim()) {
      return { command: null, source: 'local', confidence: 1, status: 'empty', matched: [], explanation: 'Please say or type an accessibility request.' };
    }
    if (INJECTION.test(raw)) {
      return { command: null, source: 'local', confidence: 1, status: 'refused', matched: ['safety'], explanation: 'For safety, AdaptAble only performs predefined accessibility adaptations — it cannot run code or follow instructions embedded in requests.' };
    }

    const t = normalize(raw);
    const cmd = emptyCommand();
    const matched = [];

    // Control words short-circuit everything else.
    for (const rule of RULES) {
      if (!rule.control) continue;
      if (rule.match.test(t)) {
        rule.apply(cmd, state, t);
        matched.push(rule.id);
        cmd.confidence = 0.98;
        cmd.explanation = describe(cmd);
        return { command: cmd, source: 'local', confidence: 0.98, status: 'ok', matched, explanation: cmd.explanation };
      }
    }

    // Positive rules first; defer negation rules so "turn off X" overrides "X".
    const negations = [];
    for (const rule of RULES) {
      if (rule.control) continue;
      if (rule.match.test(t)) {
        matched.push(rule.id);
        if (rule.negation) negations.push(rule);
        else rule.apply(cmd, state, t);
      }
    }
    for (const rule of negations) rule.apply(cmd, state, t);

    // A concrete adaptation matched alongside "find" means the adaptation wins
    // (e.g. "show me only what matters" is Simplify, not a page search).
    if (cmd.find) {
      const hasOther = Object.keys(cmd).some((k) => !['find', 'reset', 'undo', 'confidence', 'explanation', 'intensities'].includes(k) && cmd[k] !== null && cmd[k] !== undefined && cmd[k] !== false);
      if (hasOther) cmd.find = null;
    }

    if (matched.length && !isEmptyCommand(cmd)) {
      // Slightly lower confidence for a lone negation (more ambiguous).
      cmd.confidence = matched.length === 1 && matched[0] === 'turn-off' ? 0.7 : 0.9;
      cmd.explanation = describe(cmd);
      return { command: cmd, source: 'local', confidence: cmd.confidence, status: 'ok', matched, explanation: cmd.explanation };
    }

    // No confident local match. Decide between asking the AI vs rejecting.
    if (ACCESSIBILITY_HINT.test(t)) {
      return { command: null, source: 'local', confidence: 0.3, status: 'needs_api', matched: [], explanation: 'Interpreting your request…' };
    }
    return { command: null, source: 'local', confidence: 0.6, status: 'unsupported', matched: [], explanation: "AdaptAble adapts webpages for easier reading and viewing. Try things like “make the text bigger” or “this page is too busy.”" };
  }

  return { parse, describe, emptyCommand, isEmptyCommand, normalize, OFF_VALUE, _RULES: RULES };
});
