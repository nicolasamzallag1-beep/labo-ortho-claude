// app.js — logique du jeu, TTS FR, sons (WebAudio), animations, sauvegarde locale
(() => {
  // ----- Utilitaires -----
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const load = k => {
    try { return JSON.parse(localStorage.getItem(k)); }
    catch(e){ return null; }
  };

  function normalize(s){
    return s==null ? "" : s.toString().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g,"").trim();
  }

  function levenshtein(a,b){
    if(!a||!b) return (a||"").length + (b||"").length;
    const m=a.length,n=b.length;
    const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
    for(let i=0;i<=m;i++) dp[i][0]=i;
    for(let j=0;j<=n;j++) dp[0][j]=j;
    for(let i=1;i<=m;i++){
      for(let j=1;j<=n;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
      }
    }
    return dp[m][n];
  }

  function showFeedback(text, type='success'){
    const box = $('#feedback');
    box.innerHTML = `<div class="feedback ${type}">${text}</div>`;
    setTimeout(()=> {
      if (box.firstChild) box.firstChild.classList.add(type==='success' ? 'correct' : 'incorrect');
      setTimeout(()=> box.innerHTML = '', 1300);
    }, 50);
  }

  // ----- WebAudio setup for ambient and SFX -----
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  const audioNodes = { masterGain: null, ambientGain: null, sfxGain: null, ambientOscs: [] };

  if(audioCtx){
    audioNodes.masterGain = audioCtx.createGain(); audioNodes.masterGain.gain.value = 0.9;
    audioNodes.ambientGain = audioCtx.createGain(); audioNodes.ambientGain.gain.value = 0.25;
    audioNodes.sfxGain = audioCtx.createGain(); audioNodes.sfxGain.gain.value = 0.6;
    audioNodes.ambientGain.connect(audioNodes.masterGain);
    audioNodes.sfxGain.connect(audioNodes.masterGain);
    audioNodes.masterGain.connect(audioCtx.destination);
  }

  // Ambient engine (simple layered oscillators + slow LFO)
  let ambientRunning = false;
  let ambientLFO = null;
  function startAmbient(){
    if(!audioCtx || ambientRunning) return;
    // create two slow oscillators with different timbres
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.value = 80;
    const o2 = audioCtx.createOscillator(); o2.type='triangle'; o2.frequency.value = 120;
    const g1 = audioCtx.createGain(); g1.gain.value = 0.09;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.06;
    const filter = audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value = 900;
    o1.connect(g1); g1.connect(filter);
    o2.connect(g2); g2.connect(filter);
    filter.connect(audioNodes.ambientGain);
    // LFO to modulate filter frequency gently
    ambientLFO = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 200;
    ambientLFO.frequency.value = 0.05;
    ambientLFO.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    o1.start(); o2.start(); ambientLFO.start();
    audioNodes.ambientOscs = [o1,o2,ambientLFO, g1, g2, filter];
    ambientRunning = true;
  }

  function stopAmbient(){
    if(!audioCtx || !ambientRunning) return;
    const nodes = audioNodes.ambientOscs || [];
    nodes.forEach(n=>{
      try{
        if(n.stop) n.stop();
        if(n.disconnect) n.disconnect();
      }catch(e){}
    });
    audioNodes.ambientOscs = [];
    ambientRunning = false;
  }

  // SFX: success and fail using short oscillator envelopes
  function playSuccess(){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(); o.type='sine'; o.frequency.value=660;
    const g = audioCtx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(audioNodes.sfxGain);
    const now = audioCtx.currentTime;
    // simple rising "ding"
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.6, now+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.5);
    o.frequency.setValueAtTime(660, now);
    o.frequency.exponentialRampToValueAtTime(1200, now+0.18);
    o.start(now); o.stop(now+0.55);
  }

  function playFail(){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(); o.type='square'; o.frequency.value=160;
    const g = audioCtx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(audioNodes.sfxGain);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.28);
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(110, now+0.2);
    o.start(now); o.stop(now+0.32);
  }

  // ----- Settings and speech synthesis -----
  const DEFAULTS = {
    autoRead: true,
    sfxVolume: 0.6,
    ambientVolume: 0.25,
    ambientOn: true,
    voiceURI: null
  };
  const settings = Object.assign({}, DEFAULTS, load('labo_settings') || {});
  if(audioCtx){
    audioNodes.sfxGain.gain.value = settings.sfxVolume ?? DEFAULTS.sfxVolume;
    audioNodes.ambientGain.gain.value = settings.ambientVolume ?? DEFAULTS.ambientVolume;
  }
  if(settings.ambientOn) {
    // wait for a user gesture to start audio in some browsers
    document.addEventListener('click', function userStartedOnce(){
      startAmbient();
      document.removeEventListener('click', userStartedOnce);
    });
  }

  const synth = window.speechSynthesis;
  let voices = [];
  function refreshVoices(){
    voices = synth.getVoices().filter(v=>v.lang && v.lang.startsWith('fr'));
    const sel = $('#voice-select');
    if(!sel) return;
    sel.innerHTML = voices.map(v => `<option value="${v.voiceURI}">${v.name} — ${v.lang}</option>`).join('');
    if(settings.voiceURI) sel.value = settings.voiceURI;
    else if(voices.length){ settings.voiceURI = voices[0].voiceURI; sel.value = settings.voiceURI; }
  }
  window.speechSynthesis.onvoiceschanged = refreshVoices;
  refreshVoices();

  function speak(text, opts={}){
    if(!('speechSynthesis' in window)) return;
    if(!(settings.autoRead)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = opts.rate || 0.95;
    u.volume = opts.volume ?? 1;
    if(settings.voiceURI){
      const v = voices.find(x=>x.voiceURI===settings.voiceURI);
      if(v) u.voice = v;
    }
    synth.cancel();
    synth.speak(u);
  }

  // ----- UI wiring & game logic (similar à version précédente) -----
  function renderProgress(){
    const scores = load('labo_scores') || {1:{score:0,count:0},2:{score:0,count:0},3:{score:0,count:0},4:{score:0,count:0}};
    const cont = $('#progress-list');
    cont.innerHTML = [1,2,3,4].map(k=>{
      const s = scores[k] || {score:0,count:0};
      const pct = s.count ? Math.round(100 * s.score / s.count) : 0;
      return `<div class="btn muted" style="min-width:180px">
        <strong>Défi ${k}</strong><div style="font-size:13px;color:var(--muted)">Succès: ${pct}% — ${s.count} essai(s)</div>
      </div>`;
    }).join('');
  }

  // Home actions
  $$('.start-btn').forEach(b=>{
    b.addEventListener('click', e=>{
      const game = Number(e.currentTarget.dataset.game);
      openGame(game);
    });
  });

  // Modal & settings
  const modal = $('#game-modal');
  const settingsModal = $('#settings-modal');

  $('#btn-close').addEventListener('click', closeModal);
  $('#btn-settings-close').addEventListener('click', ()=>{ settingsModal.setAttribute('aria-hidden','true'); });
  $('#btn-settings').addEventListener('click', ()=>{ settingsModal.setAttribute('aria-hidden','false'); refreshVoices(); });
  $('#btn-ambient-toggle').addEventListener('click', toggleAmbientUI);
  $('#btn-save-settings').addEventListener('click', saveSettings);
  $('#voice-select').addEventListener('change', e=> settings.voiceURI = e.target.value);
  $('#sfx-volume').addEventListener('input', e=>{ if(audioCtx) audioNodes.sfxGain.gain.value = Number(e.target.value); });
  $('#ambient-volume').addEventListener('input', e=>{ if(audioCtx) audioNodes.ambientGain.gain.value = Number(e.target.value); });
  $('#auto-read').addEventListener('change', e=> settings.autoRead = e.target.checked);

  function toggleAmbientUI(){
    if(!audioCtx) return;
    if(ambientRunning){
      stopAmbient();
      settings.ambientOn = false;
      $('#btn-ambient-toggle').textContent = '🔈';
    } else {
      // resume audio context if suspended (user gesture)
      if(audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
      startAmbient();
      settings.ambientOn = true;
      $('#btn-ambient-toggle').textContent = '🔊';
    }
    save('labo_settings', settings);
  }

  function saveSettings(){
    settings.sfxVolume = Number($('#sfx-volume').value);
    settings.ambientVolume = Number($('#ambient-volume').value);
    settings.voiceURI = $('#voice-select').value || settings.voiceURI;
    settings.autoRead = $('#auto-read').checked;
    save('labo_settings', settings);
    showFeedback('Paramètres enregistrés', 'success');
    settingsModal.setAttribute('aria-hidden','true');
  }

  // Game state
  let currentGame = null;
  let currentIndex = 0;
  let session = {score:0,count:0};

  function openGame(game){
    currentGame = game;
    currentIndex = 0;
    session = {score:0,count:0};
    renderGame();
    modal.setAttribute('aria-hidden','false');
    $('#game-body').focus();
    $('#game-title').textContent = `Défi ${game}`;
  }

  function closeModal(){
    modal.setAttribute('aria-hidden','true');
    synth.cancel();
    // merge session scores into persistent storage
    const all = load('labo_scores') || {};
    const prev = all[currentGame] || {score:0,count:0};
    all[currentGame] = {score: prev.score + session.score, count: prev.count + session.count};
    save('labo_scores', all);
    renderProgress();
  }

  function sample(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }

  // RENDERERS FOR GAMES
  function renderGame(){
    const body = $('#game-body');
    const g = currentGame;
    const data = (g===1? gameData.game1 : g===2? gameData.game2 : g===3? gameData.game3 : gameData.game4);
    const item = (g===3)? data[currentIndex % data.length] : data[Math.floor(Math.random()*data.length)];
    body.innerHTML = '';
    $('#feedback').innerHTML = '';

    if(g===1){
      // Fill-in-the-blank
      const frag = document.createElement('div');
      frag.innerHTML = `<p style="font-size:1.2rem;margin-bottom:14px">${item.text.replace('___','<strong>______</strong>')}</p>
        <input id="fill-input" class="input" placeholder="Écris la réponse ici" aria-label="Réponse" />
        <div style="margin-top:12px;display:flex;gap:10px">
          <button id="fill-submit" class="btn primary">Valider</button>
          <button id="fill-hear" class="btn muted">Écouter</button>
        </div>`;
      body.appendChild(frag);

      $('#fill-hear').addEventListener('click', ()=> speak(item.text.replace('___','...')));
      $('#fill-submit').addEventListener('click', ()=>{
        const v = normalize($('#fill-input').value);
        const target = normalize(item.answer);
        const dist = levenshtein(v, target);
        const len = Math.max(target.length,1);
        const ratio = 1 - (dist/len);
        session.count++;
        if(ratio >= 0.72){
          session.score++;
          playSuccess();
          showFeedback('Bravo — bonne réponse !', 'success');
          speak('Très bien !');
        } else {
          playFail();
          showFeedback(`Réponse attendue : ${item.answer}`, 'fail');
          speak(`La bonne réponse était ${item.answer}`);
        }
        setTimeout(()=> renderGame(), 900);
      });

    } else if(g===2){
      // Reformulation (multiple choice)
      const correct = item.reformulations[0];
      const wrong = item.reformulations[1] || 'Réponse incorrecte';
      const choices = shuffle([correct, wrong]);
      const frag = document.createElement('div');
      frag.innerHTML = `<p style="font-size:1.2rem;margin-bottom:14px">${item.phrase}</p>
        <div id="choices" style="display:flex;flex-direction:column;gap:10px"></div>`;
      body.appendChild(frag);
      const choicesDiv = $('#choices');
      choices.forEach((c, idx)=>{
        const btn = document.createElement('button');
        btn.className = 'btn muted';
        btn.innerText = c;
        btn.addEventListener('click', ()=>{
          session.count++;
          if(c===correct){
            session.score++;
            playSuccess();
            showFeedback('Exact !', 'success');
            speak('Bonne réponse');
          } else {
            playFail();
            showFeedback('Ce n\'est pas la bonne reformulation', 'fail');
            speak(`Non. La bonne reformulation était: ${correct}`);
          }
          setTimeout(()=> renderGame(), 900);
        });
        choicesDiv.appendChild(btn);
      });
      speak(item.phrase);

    } else if(g===3){
      // Memory: show phrase then ask to type
      const phrase = item;
      const frag = document.createElement('div');
      frag.innerHTML = `<p style="font-size:1.1rem;margin-bottom:14px" id="memory-phrase">${phrase}</p>
        <div id="memory-controls" style="display:flex;gap:12px">
          <button id="memory-hide" class="btn primary">Masquer et restituer</button>
          <button id="memory-hear" class="btn muted">Écouter</button>
        </div>
        <div id="memory-answer" style="margin-top:12px;display:none">
          <input id="memory-input" class="input" placeholder="Écris la phrase que tu te souviens" />
          <div style="margin-top:10px"><button id="memory-submit" class="btn primary">Valider</button></div>
        </div>`;
      body.appendChild(frag);
      $('#memory-hear').addEventListener('click', ()=> speak(phrase));
      $('#memory-hide').addEventListener('click', ()=>{
        $('#memory-phrase').textContent = '••••••••••••';
        $('#memory-controls').style.display = 'none';
        $('#memory-answer').style.display = 'block';
        speak('Maintenant écris la phrase que tu as mémorisée');
      });
      $('#memory-submit').addEventListener('click', ()=>{
        const v = normalize($('#memory-input').value);
        const target = normalize(phrase);
        const d = levenshtein(v,target);
        const ratio = 1 - (d / Math.max(target.length,1));
        session.count++;
        if(ratio >= 0.75){
          session.score++;
          playSuccess();
          showFeedback('Très bonne restitution !', 'success');
          speak('Bien joué !');
        } else {
          playFail();
          showFeedback(`Proche — version attendue: "${phrase}"`, 'fail');
          speak(`Presque. La phrase était : ${phrase}`);
        }
        currentIndex++;
        setTimeout(()=> renderGame(), 900);
      });

    } else if(g===4){
      // Articulation: present tongue-twister, timer to measure speed
      const phrase = item;
      const frag = document.createElement('div');
      frag.innerHTML = `<p style="font-size:1.2rem;margin-bottom:14px">${phrase}</p>
        <div style="display:flex;gap:10px;align-items:center">
          <button id="start-timer" class="btn primary">Commencer (chrono)</button>
          <button id="hear-tw" class="btn muted">Écouter</button>
          <div id="timer" style="margin-left:8px;font-weight:700;color:var(--muted)">00:00</div>
        </div>
        <div style="margin-top:12px"><button id="mark-good" class="btn primary">Bonne diction</button>
        <button id="mark-bad" class="btn muted">Réessayer</button></div>`;
      body.appendChild(frag);

      let startT, timerInterval;
      function updateTimer(){
        const ms = Date.now() - startT;
        const s = Math.floor(ms/1000);
        const mm = String(Math.floor(s/60)).padStart(2,'0');
        const ss = String(s%60).padStart(2,'0');
        $('#timer').textContent = `${mm}:${ss}`;
      }
      $('#hear-tw').addEventListener('click', ()=> speak(phrase, {rate: 0.95}));
      $('#start-timer').addEventListener('click', ()=>{
        // resume audio context if suspended
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
        startT = Date.now();
        $('#timer').textContent = '00:00';
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 250);
        $('#start-timer').disabled = true;
        speak('Lis la phrase à haute voix maintenant');
      });

      $('#mark-good').addEventListener('click', ()=>{
        clearInterval(timerInterval);
        $('#start-timer').disabled = false;
        session.count++;
        session.score++;
        playSuccess();
        showFeedback('Très bon entraînement !', 'success');
        speak('Bravo, bonne diction');
        setTimeout(()=> renderGame(), 900);
      });

      $('#mark-bad').addEventListener('click', ()=>{
        clearInterval(timerInterval);
        $('#start-timer').disabled = false;
        session.count++;
        playFail();
        showFeedback('On reprend — tu peux réessayer.', 'fail');
        speak('Essaie encore, tu peux y arriver');
      });
    }

    $('#btn-prev').onclick = ()=> { renderGame(); };
    $('#btn-next').onclick = ()=> { renderGame(); };
  }

  // Initialize UI
  function initUI(){
    $('#sfx-volume').value = settings.sfxVolume ?? DEFAULTS.sfxVolume;
    $('#ambient-volume').value = settings.ambientVolume ?? DEFAULTS.ambientVolume;
    $('#auto-read').checked = settings.autoRead !== false;
    if(settings.ambientOn) $('#btn-ambient-toggle').textContent='🔊'; else $('#btn-ambient-toggle').textContent='🔈';
    renderProgress();

    // keyboard shortcuts
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') {
        if(modal.getAttribute('aria-hidden')==='false') closeModal();
        if(settingsModal.getAttribute('aria-hidden')==='false') settingsModal.setAttribute('aria-hidden','true');
      }
    });
  }

  initUI();
})();
