/*
  app.js — logique du jeu (sans synthèse vocale)
  - Attache les événements après DOMContentLoaded
  - Utilise WebAudio pour l'ambiance et petits effets sonores
  - Sauvegarde des scores dans localStorage
  - Gestion des 4 défis : fill, reformulation (MCQ), mémoire (phrase), articulation (virelangues)
  - Accessible et résistant aux erreurs (console logs utiles)
*/

/* Utility helpers */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const saveJSON = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));
const loadJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch (e) { console.error('Error loading JSON', e); return fallback; }
};

/* Normalisation pour comparaison de texte (retire accents, ponctuation) */
function normalizeText(str) {
  return (str || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

/* Levenshtein distance pour tolérance aux fautes */
function levenshtein(a, b) {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
    }
  }
  return dp[m][n];
}

/* --- Audio: WebAudio simple ambient + sfx --- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioCtx ? new AudioCtx() : null;
const audioNodes = {
  master: null, ambientGain: null, sfxGain: null, ambientOscs: []
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

/* Start a gentle ambient pad using two oscillators + LFO */
let ambientRunning = false;
function startAmbient() {
  if (!audioContext || ambientRunning) return;
  const o1 = audioContext.createOscillator(); o1.type = 'sine'; o1.frequency.value = 60;
  const g1 = audioContext.createGain(); g1.gain.value = 0.08;
  const o2 = audioContext.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 100;
  const g2 = audioContext.createGain(); g2.gain.value = 0.05;
  const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
  o1.connect(g1); g1.connect(filter);
  o2.connect(g2); g2.connect(filter);
  filter.connect(audioNodes.ambientGain);

  const lfo = audioContext.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.03;
  const lfoGain = audioContext.createGain(); lfoGain.gain.value = 220;
  lfo.connect(lfoGain); lfoGain.connect(filter.frequency);

  o1.start(); o2.start(); lfo.start();
  audioNodes.ambientOscs = [o1, o2, lfo, g1, g2, filter];
  ambientRunning = true;
}

/* Stop ambient safely */
function stopAmbient() {
  if (!audioContext || !ambientRunning) return;
  audioNodes.ambientOscs.forEach(n => {
    try { if (n.stop) n.stop(); if (n.disconnect) n.disconnect(); } catch(e) {}
  });
  audioNodes.ambientOscs = [];
  ambientRunning = false;
}

/* Short SFX for success / fail */
function playSuccess() {
  if (!audioContext) return;
  const o = audioContext.createOscillator(); o.type='sine';
  const g = audioContext.createGain(); g.gain.value = 0.0001;
  o.frequency.value = 660;
  o.connect(g); g.connect(audioNodes.sfxGain);
  const now = audioContext.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  o.frequency.setValueAtTime(660, now);
  o.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
  o.start(now); o.stop(now + 0.55);
}

function playFail() {
  if (!audioContext) return;
  const o = audioContext.createOscillator(); o.type='square';
  const g = audioContext.createGain(); g.gain.value = 0.0001;
  o.frequency.value = 180;
  o.connect(g); g.connect(audioNodes.sfxGain);
  const now = audioContext.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  o.start(now); o.stop(now + 0.32);
}

/* --- Settings & storage keys --- */
const SCORES_KEY = 'labo_scores_v3';
const SETTINGS_KEY = 'labo_settings_v3';
const DEFAULT_SETTINGS = { ambientOn: true, sfxVolume: 0.65, ambientVolume: 0.16 };
let settings = loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
if (audioContext) {
  audioNodes.sfxGain.gain.value = settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume;
  audioNodes.ambientGain.gain.value = settings.ambientVolume ?? DEFAULT_SETTINGS.ambientVolume;
}

/* --- Game state --- */
let currentGame = null;
let currentIndex = 0;
let session = { score: 0, count: 0 };

/* Safety check that data is loaded */
function checkDataLoaded() {
  if (typeof gameData !== 'object' || !gameData) {
    console.error('gameData is not available. Please ensure data.js is loaded and has correct syntax.');
    alert('Erreur : contenu du jeu introuvable (data.js). Vérifie que data.js est présent et valide.');
    return false;
  }
  return true;
}

/* Render progress (summary cards) */
function renderProgress() {
  const scores = loadJSON(SCORES_KEY, {1:{score:0,count:0},2:{score:0,count:0},3:{score:0,count:0},4:{score:0,count:0}});
  const container = $('#progress-list');
  if (!container) return;
  container.innerHTML = [1,2,3,4].map(k => {
    const s = scores[k] || {score:0,count:0};
    const pct = s.count ? Math.round(100 * s.score / s.count) : 0;
    return `<div class="btn muted" style="min-width:180px">
      <strong>Défi ${k}</strong><div style="font-size:13px;color:var(--muted)">Succès: ${pct}% — ${s.count} essai(s)</div>
    </div>`;
  }).join('');
}

/* Open game modal and initialize session */
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

/* Close modal and persist session scores */
function closeGame() {
  $('#game-modal').setAttribute('aria-hidden', 'true');
  // Merge session into persistent scores
  const all = loadJSON(SCORES_KEY, {});
  const prev = all[currentGame] || { score: 0, count: 0 };
  all[currentGame] = { score: prev.score + session.score, count: prev.count + session.count };
  saveJSON(SCORES_KEY, all);
  renderProgress();
}

/* Render current exercise depending on game type */
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

  // Helper to show feedback
  function showFB(text, ok=true) {
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'success' : 'fail');
    fb.textContent = text;
    // small animation
    if (ok) fb.classList.add('correct'); else fb.classList.add('incorrect');
    setTimeout(() => { fb.className = 'feedback'; fb.textContent = ''; }, 1500);
  }

  if (g === 1) {
    // Fill-in-the-blank: iterate sequentially through list (good for training)
    const item = data[currentIndex % data.length];
    body.innerHTML = `
      <p style="font-size:1.15rem;margin-bottom:12px">${item.text.replace('___', '<strong>______</strong>')}</p>
      <input id="fill-input" class="input-field" placeholder="Écris la réponse ici" aria-label="Réponse"/>
      <div style="margin-top:12px;display:flex;gap:10px">
        <button id="fill-submit" class="btn primary">Valider</button>
        <button id="fill-skip" class="btn muted">Passer</button>
      </div>
    `;
    $('#fill-input').focus();
    $('#fill-submit').addEventListener('click', () => {
      const user = normalizeText($('#fill-input').value);
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
    });
    $('#fill-skip').addEventListener('click', () => {
      currentIndex++; renderCurrent();
    });

  } else if (g === 2) {
    // Reformulation: random item, present two choices (correct is first)
    const item = data[Math.floor(Math.random() * data.length)];
    // If there are only 2 options (one correct, one wrong) use them. If more, choose distractors.
    const correct = item.reformulations[0];
    let wrong = item.reformulations[1] || 'Réponse incorrecte';
    // build choices and shuffle
    const choices = shuffle([correct, wrong]);
    body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:14px">${item.phrase}</p>
      <div id="choices" style="display:flex;flex-direction:column;gap:10px"></div>`;
    const choicesDiv = $('#choices');
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'btn muted';
      btn.innerText = c;
      btn.addEventListener('click', () => {
        session.count++;
        if (c === correct) { session.score++; playSuccess(); showFB('Exact !', true); }
        else { playFail(); showFB('Ce n\'est pas la bonne reformulation', false); }
        setTimeout(renderCurrent, 900);
      });
      choicesDiv.appendChild(btn);
    });

  } else if (g === 3) {
    // Memory: show phrase, allow hide then user types
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
    $('#memory-hide').addEventListener('click', () => {
      $('#memory-phrase').textContent = '••••••••••••';
      $('#memory-controls').style.display = 'none';
      $('#memory-answer').style.display = 'block';
      $('#memory-input').focus();
    });
    $('#memory-submit').addEventListener('click', () => {
      const val = normalizeText($('#memory-input').value);
      const target = normalizeText(phrase);
      const d = levenshtein(val, target);
      const ratio = 1 - (d / Math.max(target.length,1));
      session.count++;
      if (ratio >= 0.75) { session.score++; playSuccess(); showFB('Très bonne restitution !', true); }
      else { playFail(); showFB(`Proche — version attendue : "${phrase}"`, false); }
      currentIndex++;
      setTimeout(renderCurrent, 900);
    });
    $('#memory-next').addEventListener('click', () => { currentIndex++; renderCurrent(); });

  } else if (g === 4) {
    // Articulation: present tongue-twister, timer, mark good/bad
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
      const mm = String(Math.floor(s/60)).padStart(2,'0');
      const ss = String(s%60).padStart(2,'0');
      $('#timer').textContent = `${mm}:${ss}`;
    }
    $('#start-timer').addEventListener('click', () => {
      if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
      startT = Date.now(); $('#timer').textContent = '00:00';
      clearInterval(timerInt);
      timerInt = setInterval(updateTimer, 250);
      $('#start-timer').disabled = true;
    });
    $('#mark-good').addEventListener('click', () => {
      clearInterval(timerInt); $('#start-timer').disabled = false;
      session.count++; session.score++;
      playSuccess(); showFB('Très bon entraînement !', true);
      setTimeout(renderCurrent, 900);
    });
    $('#mark-bad').addEventListener('click', () => {
      clearInterval(timerInt); $('#start-timer').disabled = false;
      session.count++;
      playFail(); showFB('On reprend — tu peux réessayer.', false);
    });
  }
}

/* Shuffle utility (in-place) */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Attach event listeners after DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  // Safety: ensure DOM elements exist
  try {
    if (!checkDataLoaded()) return;

    // Start ambient depending on settings, but require user gesture for autoplay in many browsers.
    if (settings.ambientOn && audioContext) {
      // Wait for first meaningful user gesture (click) to start audio
      const startAudioAfterUserGesture = () => {
        startAmbient();
        document.removeEventListener('click', startAudioAfterUserGesture);
      };
      document.addEventListener('click', startAudioAfterUserGesture);
    }

    // Ambient toggle button
    const ambientBtn = $('#btn-ambient-toggle');
    if (ambientBtn) {
      ambientBtn.addEventListener('click', () => {
        if (!audioContext) return;
        if (audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
        if (ambientRunning) {
          stopAmbient(); settings.ambientOn = false; ambientBtn.setAttribute('aria-pressed','false');
          ambientBtn.textContent = '🔈';
        } else {
          startAmbient(); settings.ambientOn = true; ambientBtn.setAttribute('aria-pressed','true');
          ambientBtn.textContent = '🔊';
        }
        saveJSON(SETTINGS_KEY, settings);
      });
      // Reflect initial state
      ambientBtn.textContent = settings.ambientOn ? '🔊' : '🔈';
      ambientBtn.setAttribute('aria-pressed', settings.ambientOn ? 'true' : 'false');
    }

    // Start buttons on home screen
    $$('.start-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gameId = Number(e.currentTarget.dataset.game);
        openGame(gameId);
      });
    });

    // Modal controls
    const closeBtn = $('#btn-close');
    if (closeBtn) closeBtn.addEventListener('click', closeGame);
    const prevBtn = $('#btn-prev');
    const nextBtn = $('#btn-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      // for games that use currentIndex (1 & 3) allow going back
      if (currentGame === 1 || currentGame === 3) {
        currentIndex = Math.max(0, currentIndex - 1);
      }
      renderCurrent();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (currentGame === 1 || currentGame === 3) currentIndex++;
      renderCurrent();
    });

    // Keyboard: Esc to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#game-modal') && $('#game-modal').getAttribute('aria-hidden') === 'false') {
        closeGame();
      }
    });

    renderProgress();
  } catch (err) {
    console.error('Initialization error:', err);
    alert('Erreur lors de l\'initialisation du jeu. Ouvre la console (F12) et copie la première erreur ici pour que je corrige.');
  }
});
