const API_URL = 'https://voicevision-eight.vercel.app/api/interpret';
const SITE_URL = 'https://voicevision-eight.vercel.app';

const micBtn = document.getElementById('micBtn');
const openSiteBtn = document.getElementById('openSiteBtn');
const transcriptEl = document.getElementById('transcript');
const explanationEl = document.getElementById('explanation');
const filtersEl = document.getElementById('filters');

const MODE_LABELS = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Grayscale',
};

const ZOOM_LABELS = {
  center: 'Central Vision Loss',
  peripheral: 'Tunnel Vision',
  full: 'Magnified',
};

const HEMIANOPIA_LABELS = {
  left: 'Hemianopia (Left)',
  right: 'Hemianopia (Right)',
};

let lastState = null;
let activePort = null;

// Each entry: key = state field cleared by ×, intensityKey = state.intensities field (or
// 'brightness' for the direct-value brightness filter), null = no slider.
function getActiveFilters(state) {
  const items = [];
  if (state.colorMode) {
    items.push({ key: 'colorMode', label: MODE_LABELS[state.colorMode] ?? state.colorMode, intensityKey: 'colorMode' });
  }
  if (state.darkMode) items.push({ key: 'darkMode', label: 'Dark Mode', intensityKey: 'darkMode' });
  if (state.highContrast) items.push({ key: 'highContrast', label: 'High Contrast', intensityKey: 'highContrast' });
  if (state.warmTone) items.push({ key: 'warmTone', label: 'Warm Tone', intensityKey: 'warmTone' });
  if (state.invertColors && !state.darkMode) items.push({ key: 'invertColors', label: 'Inverted', intensityKey: 'invertColors' });
  if (state.blur) items.push({ key: 'blur', label: 'Cataracts (Clarity Boost)', intensityKey: 'blur' });
  if (state.brightness !== null && state.brightness !== undefined) {
    items.push({ key: 'brightness', label: 'Brightness', intensityKey: 'brightness', min: 0.1, max: 1.5, step: 0.05 });
  }
  if (state.zoom) items.push({ key: 'zoom', label: ZOOM_LABELS[state.zoom] ?? state.zoom, intensityKey: 'zoom' });
  if (state.hemianopia) items.push({ key: 'hemianopia', label: HEMIANOPIA_LABELS[state.hemianopia] ?? state.hemianopia, intensityKey: null });
  if (state.dimOverlay) items.push({ key: 'dimOverlay', label: 'Light Sensitivity Dimmer', intensityKey: 'dimOverlay' });
  if (state.boldText) items.push({ key: 'boldText', label: 'Bold Text', intensityKey: null });
  if (state.reduceMotion) items.push({ key: 'reduceMotion', label: 'Reduced Motion', intensityKey: null });
  return items;
}

function renderBadges(state) {
  if (!state) return;
  lastState = state;
  const items = getActiveFilters(state);

  if (!items.length) {
    filtersEl.innerHTML = '<span class="empty">No filters active</span>';
    return;
  }

  filtersEl.innerHTML = items.map((item) => {
    let slider = '';
    if (item.intensityKey === 'brightness') {
      slider = `<input type="range" class="filter-slider" data-intensity-key="brightness"
        min="${item.min}" max="${item.max}" step="${item.step}" value="${state.brightness}">`;
    } else if (item.intensityKey) {
      const value = state.intensities?.[item.intensityKey] ?? 1;
      slider = `<input type="range" class="filter-slider" data-intensity-key="${item.intensityKey}"
        min="0" max="1" step="0.05" value="${value}">`;
    }
    return `<div class="filter-row" data-key="${item.key}">
      <span class="filter-label">${item.label}</span>
      ${slider}
      <button class="filter-remove" data-key="${item.key}" title="Turn off">×</button>
    </div>`;
  }).join('');
}

filtersEl.addEventListener('change', async (e) => {
  const target = e.target;
  if (!target.matches('.filter-slider')) return;
  const key = target.dataset.intensityKey;
  const value = parseFloat(target.value);
  const state = await sendToActiveTab({ type: 'SET_INTENSITY', key, value });
  renderBadges(state);
});

filtersEl.addEventListener('click', async (e) => {
  const target = e.target;
  if (!target.matches('.filter-remove')) return;
  const key = target.dataset.key;
  const state = await sendToActiveTab({ type: 'TOGGLE_FILTER', key });
  renderBadges(state);
});

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null; // content script not present (e.g. chrome:// pages)
  }
}

async function handleTranscript(text) {
  transcriptEl.textContent = `“${text}”`;
  explanationEl.textContent = 'Thinking…';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, currentState: lastState }),
    });
    const command = await res.json();
    if (command.error) {
      explanationEl.textContent = command.error;
      return;
    }
    explanationEl.textContent = command.explanation ?? '';
    const state = await sendToActiveTab({ type: 'APPLY_COMMAND', command });
    renderBadges(state);
  } catch {
    explanationEl.textContent = 'Could not reach VoiceVision API — check your connection.';
  }
}

// Recognition runs in the content script (page origin) — chrome-extension:// popup
// origins can't hold a mic permission grant. Streamed back over a port.
async function startListening() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    transcriptEl.textContent = 'No active tab — open a regular webpage to use voice commands.';
    return;
  }

  let port;
  try {
    port = chrome.tabs.connect(tab.id, { name: 'voicevision-mic' });
  } catch {
    transcriptEl.textContent = 'Open a regular webpage to use voice commands.';
    return;
  }

  activePort = port;

  port.onDisconnect.addListener(() => {
    activePort = null;
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎤 Hold to Speak';
    if (chrome.runtime.lastError) {
      transcriptEl.textContent = 'Open a regular webpage (not a chrome:// page) to use voice commands.';
    }
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'start') {
      micBtn.classList.add('listening');
      micBtn.textContent = '🎤 Listening…';
      return;
    }
    if (msg.type === 'end') {
      activePort = null;
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤 Hold to Speak';
      return;
    }
    if (msg.type === 'result') {
      handleTranscript(msg.transcript);
      return;
    }
    if (msg.type === 'error') {
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤 Hold to Speak';
      if (msg.error === 'unsupported') {
        transcriptEl.textContent = 'Voice not supported on this page — try Chrome on a regular https:// site.';
        return;
      }
      if (msg.error === 'not-allowed' || msg.error === 'service-not-allowed') {
        transcriptEl.textContent = 'Microphone access denied. Click the lock icon in the address bar of this tab → Site settings → allow Microphone, then try again.';
        return;
      }
      transcriptEl.textContent = `Mic error: ${msg.error}`;
    }
  });

  port.postMessage({ type: 'START' });
}

micBtn.addEventListener('click', () => {
  if (activePort) {
    activePort.postMessage({ type: 'STOP' });
    activePort.disconnect();
    activePort = null;
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎤 Hold to Speak';
    return;
  }
  startListening();
});
openSiteBtn.addEventListener('click', () => chrome.tabs.create({ url: SITE_URL }));

// Reflect whatever filters are already active on this tab when the popup opens
sendToActiveTab({ type: 'GET_STATE' }).then(renderBadges);
