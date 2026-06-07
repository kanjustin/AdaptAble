const API_URL = 'https://voicevision-eight.vercel.app/api/interpret';

const micBtn = document.getElementById('micBtn');
const transcriptEl = document.getElementById('transcript');
const explanationEl = document.getElementById('explanation');
const badgesEl = document.getElementById('badges');

const MODE_LABELS = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Grayscale',
};

function renderBadges(state) {
  if (!state) return;
  const active = [];
  if (state.colorMode) active.push(MODE_LABELS[state.colorMode] ?? state.colorMode);
  if (state.darkMode) active.push('Dark Mode');
  if (state.highContrast) active.push('High Contrast');
  if (state.warmTone) active.push('Warm Tone');
  if (state.invertColors) active.push('Inverted');
  if (state.brightness !== null && state.brightness !== undefined) active.push(`Brightness ${state.brightness}`);

  badgesEl.innerHTML = active.length
    ? active.map((label) => `<span class="badge">${label}</span>`).join('')
    : '<span class="empty">No filters active</span>';
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null; // content script not present (e.g. chrome:// pages)
  }
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    transcriptEl.textContent = 'Voice not supported — open this popup in Chrome or Edge.';
    return;
  }

  const recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    micBtn.classList.add('listening');
    micBtn.textContent = '🎤 Listening…';
  };
  recognition.onend = () => {
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎤 Hold to Speak';
  };
  recognition.onerror = (e) => {
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎤 Hold to Speak';
    transcriptEl.textContent = `Mic error: ${e.error}. Click the lock icon → Site settings → allow microphone for this extension.`;
  };
  recognition.onresult = async (e) => {
    const text = e.results[0][0].transcript;
    transcriptEl.textContent = `“${text}”`;
    explanationEl.textContent = 'Thinking…';

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
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
  };

  recognition.start();
}

micBtn.addEventListener('click', startListening);

// Reflect whatever filters are already active on this tab when the popup opens
sendToActiveTab({ type: 'GET_STATE' }).then(renderBadges);
