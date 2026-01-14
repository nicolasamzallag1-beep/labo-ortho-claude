const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const SCORES_KEY = 'labo_scores_v3';
const SETTINGS_KEY = 'labo_settings_v3';

const playerName = "Claude";

let currentGame = null;
let currentIndex = 0;
let session = { score: 0, count: 0 };

function saveJSON(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(str) {
  return (str || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function levenshtein(a, b) {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkDataLoaded() {
  if (typeof gameData !== 'object' || !gameData) {
    alert('Erreur : contenu du jeu introuvable (data.js).');
    return false;
  }
  return true;
}

function renderProgress() {
  const scores = loadJSON(SCORES_KEY, { 1: { score: 0, count: 0 }, 2: { score: 0, count: 0 }, 3: { score: 0, count: 0 }, 4: { score: 0, count: 0 } });
  const container = $('#progress-list');
  if (!container) return;
  container.innerHTML = [1, 2, 3, 4].map(k => {
    const s = scores[k] || { score: 0, count: 0 };
    const pct = s.count ? Math.round(100 * s.score / s.count) : 0;
    return `<div class="btn muted" style="min-width:180px">
      <strong>Défi ${k}</strong><div style="font-size:13px;color:var(--muted)">Succès: ${pct}% — ${s.count} essai(s)</div>
    </div>`;
  }).join('');
}

function openGame(gameId) {
  if (!checkDataLoaded()) return;
  currentGame = Number(gameId);
  currentIndex = 0;
  session = { score: 0, count: 0 };
  $('#game-title').textContent = `Défi ${currentGame}`;
  $('#game-modal').setAttribute('aria-hidden', 'false');
  $('#game-body').focus();
  renderCurrent();
}

function closeGame() {
  $('#game-modal').setAttribute('aria-hidden', 'true');
  const all = loadJSON(SCORES_KEY, {});
  const prev = all[currentGame] || { score: 0, count: 0 };
  all[currentGame] = { score: prev.score + session.score, count: prev.count + session.count };
  saveJSON(SCORES_KEY, all);
  renderProgress();
}

function showFB(text, ok = true) {
  const fb = $('#feedback');
  fb.className = 'feedback ' + (ok ? 'success' : 'fail');
  fb.textContent = text;
  if (ok) fb.classList.add('correct'); else fb.classList.add('incorrect');
  setTimeout(() => { fb.className = 'feedback'; fb.textContent = ''; }, 1500);
}

function renderCurrent() {
  const body = $('#game-body');
  body.innerHTML = '';
  $('#feedback').innerHTML = '';
  const g = currentGame;
  const data = gameData[`game${g}`];
  if (!Array.isArray(data) || data.length === 0) {
    body.innerHTML = '<p>Aucune donnée pour cet exercice.</p>';
    return;
  }

  if (g === 1) {
    const item = data[currentIndex % data.length];
    body.innerHTML = `
      <p style="font-size:1.15rem;margin-bottom:12px">${item.text.replace('___', '<strong>______</strong>')}</p>
      <input id="fill-input" class="input-field" placeholder="Écris la réponse ici" aria-label="Réponse"/>
      <div style="margin-top:12px;display:flex;gap:10px">
        <button id="fill-submit" class="btn primary">Valider</button>
        <button id="fill-skip" class="btn muted">Passer</button>
      </div>
    `;
    const fillInput = $('#fill-input');
    const fillSubmit = $('#fill-submit');
    const fillSkip = $('#fill-skip');

    fillInput.focus();

    fillSubmit.onclick = () => {
      const user = normalizeText(fillInput.value);
      const target = normalizeText(item.answer);
      const dist = levenshtein(user, target);
      const ratio = 1 - (dist / Math.max(target.length, 1));
      session.count++;
      if (ratio >= 0.72) {
        session.score++; playSuccess(); showFB('Bravo — bonne réponse !', true);
      } else {
        playFail(); showFB(`Réponse attendue : ${item.answer}`, false);
      }
      currentIndex++;
      setTimeout(renderCurrent, 900);
    };

    fillSkip.onclick = () => {
      currentIndex++;
      renderCurrent();
    };

  } else if (g === 2) {
    const item = data[Math.floor(Math.random() * data.length)];
    const correct = item.reformulations[0];
    let wrong = item.reformulations[1] || 'Réponse incorrecte';
    const choices = shuffle([correct, wrong]);
    body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:14px">${item.phrase}</p>
      <div id="choices" style="display:flex;flex-direction:column;gap:10px"></div>`;
    const choicesDiv = $('#choices');
    choicesDiv.innerHTML = '';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'btn muted';
      btn.innerText = c;
      btn.onclick = () => {
        session.count++;
        if (c === correct) { session.score++; playSuccess(); showFB('Exact !', true); }
        else { playFail(); showFB('Ce n\'est pas la bonne reformulation', false); }
        setTimeout(renderCurrent, 900);
      };
      choicesDiv.appendChild(btn);
    });

  } else if (g === 3) {
    const phrase = data[currentIndex % data.length];
    body.innerHTML = `
      <p id="memory-phrase" style="font-size:1.12rem;margin-bottom:14px">${phrase}</p>
      <div id="memory-controls" style="display:flex;gap:12px">
        <button id="memory-hide" class="btn primary">Masquer et restituer</button>
        <button id="memory-next" class="btn muted">Suivant</button>
      </div>
      <div id="memory-answer" style="margin-top:12px;display:none">
        <input id="memory-input" class="input-field" placeholder="Écris la phrase que tu te souviens" aria-label="Phrase à restituer"/>
        <div style="margin-top:10px"><button id="memory-submit" class="btn primary">Valider</button></div>
      </div>
    `;

    $('#memory-hide').onclick = () => {
      $('#memory-phrase').textContent = '••••••••••••';
      $('#memory-controls').style.display = 'none';
      $('#memory-answer').style.display = 'block';
      $('#memory-input').focus();
    };

    $('#memory-submit').onclick = () => {
      const val = normalizeText($('#memory-input').value);
      const target = normalizeText(phrase);
      const d = levenshtein(val, target);
      const ratio = 1 - (d / Math.max(target.length, 1));
      session.count++;
      if (ratio >= 0.75) { session.score++; playSuccess(); showFB('Très bonne restitution !', true); }
      else { playFail(); showFB(`Proche — version attendue : "${phrase}"`, false); }
      currentIndex++;
      setTimeout(renderCurrent, 900);
    };

    $('#memory-next').onclick = () => {
      currentIndex++;
      renderCurrent();
    };

  } else if (g === 4) {
    const phrase = data[Math.floor(Math.random() * data.length)];
    body.innerHTML = `
      <p style="font-size:1.15rem;margin-bottom:14px">${phrase}</p>
      <div style="display:flex;gap:10px;align-items:center">
        <button id="start-timer" class="btn primary">Commencer (chrono)</button>
        <div id="timer" style="margin-left:8px;font-weight:700;color:var(--muted)">00:00</div>
      </div>
      <div style="margin-top:12px"><button id="mark-good" class="btn primary">Bonne diction</button>
      <button id="mark-bad" class="btn muted">Réessayer</button></div>
    `;
    let startT = null, timerInt = null;
    function updateTimer() {
      const ms = Date.now() - startT;
      const s = Math.floor(ms / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      $('#timer').textContent = `${mm}:${ss}`;
    }
    $('#start-timer').onclick = () => {
      startT = Date.now();
      $('#timer').textContent = '00:00';
      clearInterval(timerInt);
      timerInt = setInterval(updateTimer, 250);
      $('#start-timer').disabled = true;
    };
    $('#mark-good').onclick = () => {
      clearInterval(timerInt);
      $('#start-timer').disabled = false;
      session.count++;
      session.score++;
      playSuccess();
      showFB('Très bon entraînement !', true);
      setTimeout(renderCurrent, 900);
    };
    $('#mark-bad').onclick = () => {
      clearInterval(timerInt);
      $('#start-timer').disabled = false;
      session.count++;
      playFail();
      showFB('On reprend — tu peux réessayer.', false);
    };
  }
}

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioCtx ? new AudioCtx() : null;
const audioNodes = {
  master: null,
  ambientGain: null,
  sfxGain: null,
  ambientOscs: []
};
if (audioContext) {
  audioNodes.master = audioContext.createGain();
  audioNodes.ambientGain = audioContext.createGain();
  audioNodes.sfxGain = audioContext.createGain();
  audioNodes.ambientGain.connect(audioNodes.master);
  audioNodes.sfxGain.connect(audioNodes.master);
  audioNodes.master.connect(audioContext.destination);
  audioNodes.master.gain.value = 0.9;
  audioNodes.ambientGain.gain.value = 0.16;
  audioNodes.sfxGain.gain.value = 0.65;
}

let ambientRunning = false;
function startAmbient() {
  if (!audioContext || ambientRunning) return;
  const o1 = audioContext.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 60;
  const g1 = audioContext.createGain();
  g1.gain.value = 0.08;
  const o2 = audioContext.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = 100;
  const g2 = audioContext.createGain();
  g2.gain.value = 0.05;
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  o1.connect(g1);
  g1.connect(filter);
  o2.connect(g2);
  g2.connect(filter);
  filter.connect(audioNodes.ambientGain);

  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.03;
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  o1.start();
  o2.start();
  lfo.start();
  audioNodes.ambientOscs = [o1, o2, lfo, g1, g2, filter];
  ambientRunning = true;
}

function stopAmbient() {
  if (!audioContext || !ambientRunning) return;
  audioNodes.ambientOscs.forEach(n => {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
    } catch (e) { }
  });
  audioNodes.ambientOscs = [];
  ambientRunning = false;
}

function playSuccess() {
  if (!audioContext) return;
  const o = audioContext.createOscillator();
  o.type = 'sine';
  const g = audioContext.createGain();
  g.gain.value = 0.0001;
  o.frequency.value = 660;
  o.connect(g);
  g.connect(audioNodes.sfxGain);
  const now = audioContext.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  o.frequency.setValueAtTime(660, now);
  o.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
  o.start(now);
  o.stop(now + 0.55);
}

function playFail() {
  if (!audioContext) return;
  const o = audioContext.createOscillator();
  o.type = 'square';
  const g = audioContext.createGain();
  g.gain.value = 0.0001;
  o.frequency.value = 180;
  o.connect(g);
  g.connect(audioNodes.sfxGain);
  const now = audioContext.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  o.start(now);
  o.stop(now + 0.32);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkDataLoaded()) return;

  if (settings.ambientOn && audioContext) {
    const startAudioAfterUserGesture = () => {
      startAmbient();
      document.removeEventListener('click', startAudioAfterUserGesture);
    };
    document.addEventListener('click', startAudioAfterUserGesture);
  }

  const ambientBtn = $('#btn-ambient-toggle');
  if (ambientBtn) {
    ambientBtn.addEventListener('click', () => {
      if (!audioContext) return;
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => { });
      if (ambientRunning) {
        stopAmbient();
        settings.ambientOn = false;
        ambientBtn.setAttribute('aria-pressed', 'false');
        ambientBtn.textContent = '🔈';
      } else {
        startAmbient();
        settings.ambientOn = true;
        ambientBtn.setAttribute('aria-pressed', 'true');
        ambientBtn.textContent = '🔊';
      }
      saveJSON(SETTINGS_KEY, settings);
    });
    ambientBtn.textContent = settings.ambientOn ? '🔊' : '🔈';
    ambientBtn.setAttribute('aria-pressed', settings.ambientOn ? 'true' : 'false');
  }

  $$('.start-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const gameId = Number(e.currentTarget.dataset.game);
      openGame(gameId);
    });
  });

  const closeBtn = $('#btn-close');
  if (closeBtn) closeBtn.addEventListener('click', closeGame);

  const prevBtn = $('#btn-prev');
  const nextBtn = $('#btn-next');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentGame === 1 || currentGame === 3) {
      currentIndex = Math.max(0, currentIndex - 1);
    }
    renderCurrent();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentGame === 1 || currentGame === 3) currentIndex++;
    renderCurrent();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#game-modal') && $('#game-modal').getAttribute('aria-hidden') === 'false') {
      closeGame();
    }
  });

  renderProgress();
});
