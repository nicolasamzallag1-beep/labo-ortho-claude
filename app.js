// app.js — logique du jeu. Fichier autonome.
// Assure-toi que data.js est chargé avant ce fichier.

(() => {
  // Helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } };

  function normalize(s){
    return (s||"").toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g,"").trim();
  }

  function levenshtein(a,b){
    if(!a||!b) return (a||"").length + (b||"").length;
    const m=a.length, n=b.length;
    const d = Array.from({length:m+1}, ()=> Array(n+1).fill(0));
    for(let i=0;i<=m;i++) d[i][0]=i;
    for(let j=0;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++){
      for(let j=1;j<=n;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
      }
    }
    return d[m][n];
  }

  function showFeedback(text, type='success'){
    const box = $('#feedback');
    box.innerHTML = `<div class="feedback ${type}">${text}</div>`;
    setTimeout(()=> {
      if (box.firstChild) box.firstChild.classList.add(type==='success' ? 'correct' : 'incorrect');
      setTimeout(()=> box.innerHTML = '', 1400);
    }, 30);
  }

  // Audio (WebAudio)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  const audio = { master: null, ambientGain: null, sfxGain: null, ambientNodes: [] };

  if(audioCtx){
    audio.master = audioCtx.createGain(); audio.master.gain.value = 0.9;
    audio.ambientGain = audioCtx.createGain(); audio.ambientGain.gain.value = 0.18;
    audio.sfxGain = audioCtx.createGain(); audio.sfxGain.gain.value = 0.7;
    audio.ambientGain.connect(audio.master); audio.sfxGain.connect(audio.master); audio.master.connect(audioCtx.destination);
  }

  let ambientRunning = false;
  function startAmbient(){
    if(!audioCtx || ambientRunning) return;
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.value = 72;
    const o2 = audioCtx.createOscillator(); o2.type='triangle'; o2.frequency.value = 110;
    const g1 = audioCtx.createGain(); g1.gain.value = 0.08;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.05;
    const filter = audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value = 900;
    o1.connect(g1); g1.connect(filter); o2.connect(g2); g2.connect(filter);
    filter.connect(audio.ambientGain);
    // LFO for filter movement
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.value = 0.03;
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 200;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    o1.start(); o2.start(); lfo.start();
    audio.ambientNodes = [o1,o2,lfo,g1,g2,filter];
    ambientRunning = true;
  }
  function stopAmbient(){
    if(!audioCtx || !ambientRunning) return;
    audio.ambientNodes.forEach(n=>{ try{ if(n.stop) n.stop(); if(n.disconnect) n.disconnect(); }catch(e){} });
    audio.ambientNodes = [];
    ambientRunning = false;
  }
  function playSuccess(){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(); o.type='sine'; o.frequency.value = 660;
    const g = audioCtx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(audio.sfxGain);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.6, now+0.02); g.gain.exponentialRampToValueAtTime(0.0001, now+0.5);
    o.start(now); o.stop(now+0.55);
  }
  function playFail(){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(); o.type='square'; o.frequency.value = 160;
    const g = audioCtx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(audio.sfxGain);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.5, now+0.02); g.gain.exponentialRampToValueAtTime(0.0001, now+0.28);
    o.start(now); o.stop(now+0.32);
  }

  // Speech synthesis
  const synth = window.speechSynthesis || null;
  let voices = [];
  function loadVoices(){
    if(!synth) return;
    voices = synth.getVoices().filter(v => v.lang && v.lang.startsWith('fr'));
  }
  loadVoices();
  if(synth) synth.onvoiceschanged = loadVoices;

  const SETTINGS_KEY = 'labo_settings_v1';
  const DEFAULTS = { autoRead: true, ambientOn: false, sfxVolume:0.7, ambientVolume:0.18 };
  const settings = Object.assign({}, DEFAULTS, load(SETTINGS_KEY) || {});

  if(audioCtx){
    audio.sfxGain.gain.value = settings.sfxVolume ?? DEFAULTS.sfxVolume;
    audio.ambientGain.gain.value = settings.ambientVolume ?? DEFAULTS.ambientVolume;
  }

  function speak(text, opts={rate:0.95, volume:1}){
    if(!synth || !settings.autoRead) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = opts.rate;
    u.volume = opts.volume;
    if(voices.length) u.voice = voices[0];
    synth.speak(u);
  }

  // Progress rendering
  function renderProgress(){
    const scores = load('labo_scores_v1') || {1:{score:0,count:0},2:{score:0,count:0},3:{score:0,count:0},4:{score:0,count:0}};
    const cont = $('#progress-list');
    cont.innerHTML = [1,2,3,4].map(k=>{
      const s = scores[k] || {score:0,count:0};
      const pct = s.count ? Math.round(100 * s.score / s.count) : 0;
      return `<div class="btn muted" style="min-width:180px">
        <strong>Défi ${k}</strong><div style="font-size:13px;color:var(--muted)">Succès: ${pct}% — ${s.count} essai(s)</div>
      </div>`;
    }).join('');
  }

  // Game state
  let currentGame = null, currentIndex = 0, session = {score:0,count:0};

  // Utility: shuffle
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }

  // Render game (switch by game id)
  function renderGame(){
    const body = $('#game-body');
    if(!currentGame) return;
    body.innerHTML = '';
    $('#feedback').innerHTML = '';
    const g = currentGame;
    const data = (g===1? gameData.game1 : g===2? gameData.game2 : g===3? gameData.game3 : gameData.game4);

    if(g===1){
      const item = data[currentIndex % data.length];
      const html = `<p style="font-size:1.15rem;margin-bottom:12px">${item.text.replace('___','<strong>______</strong>')}</p>
        <input id="fill-input" class="input" placeholder="Écris la réponse ici" aria-label="Réponse" />
        <div style="margin-top:12px;display:flex;gap:10px">
          <button id="fill-submit" class="btn primary">Valider</button>
          <button id="fill-hear" class="btn muted">Écouter</button>
        </div>`;
      body.innerHTML = html;
      $('#fill-hear').addEventListener('click', ()=> speak(item.text.replace('___','...')));
      $('#fill-submit').addEventListener('click', ()=>{
        const v = normalize($('#fill-input').value);
        const target = normalize(item.answer);
        const dist = levenshtein(v, target);
        const ratio = 1 - (dist / Math.max(target.length,1));
        session.count++;
        if(ratio >= 0.72){
          session.score++; playSuccess(); showFeedback('Bravo — bonne réponse !', 'success'); speak('Très bien !');
        } else {
          playFail(); showFeedback(`Réponse attendue : ${item.answer}`, 'fail'); speak(`La bonne réponse était ${item.answer}`);
        }
        currentIndex++;
        setTimeout(()=> renderGame(), 900);
      });

    } else if(g===2){
      const item = data[Math.floor(Math.random()*data.length)];
      const correct = item.reformulations[0];
      const wrong = item.reformulations[1] || 'Réponse incorrecte';
      const choices = shuffle([correct, wrong]);
      body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:12px">${item.phrase}</p><div id="choices" style="display:flex;flex-direction:column;gap:10px"></div>`;
      const container = $('#choices');
      choices.forEach(c=>{
        const btn = document.createElement('button'); btn.className='btn muted'; btn.innerText = c;
        btn.addEventListener('click', ()=>{
          session.count++;
          if(c===correct){ session.score++; playSuccess(); showFeedback('Exact !', 'success'); speak('Bonne réponse'); }
          else { playFail(); showFeedback('Ce n\'est pas la bonne reformulation', 'fail'); speak(`Non. La bonne reformulation était: ${correct}`); }
          setTimeout(()=> renderGame(), 900);
        });
        container.appendChild(btn);
      });
      speak(item.phrase);

    } else if(g===3){
      const phrase = data[currentIndex % data.length];
      body.innerHTML = `<p id="memory-phrase" style="font-size:1.12rem;margin-bottom:12px">${phrase}</p>
        <div id="memory-controls" style="display:flex;gap:12px">
          <button id="memory-hide" class="btn primary">Masquer et restituer</button>
          <button id="memory-hear" class="btn muted">Écouter</button>
        </div>
        <div id="memory-answer" style="margin-top:12px;display:none">
          <input id="memory-input" class="input" placeholder="Écris la phrase que tu te souviens" />
          <div style="margin-top:10px"><button id="memory-submit" class="btn primary">Valider</button></div>
        </div>`;
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
        if(ratio >= 0.75){ session.score++; playSuccess(); showFeedback('Très bonne restitution !', 'success'); speak('Bien joué !'); }
        else { playFail(); showFeedback(`Proche — version attendue: "${phrase}"`, 'fail'); speak(`La phrase était : ${phrase}`); }
        currentIndex++;
        setTimeout(()=> renderGame(), 900);
      });

    } else if(g===4){
      const phrase = data[Math.floor(Math.random()*data.length)];
      body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:12px">${phrase}</p>
        <div style="display:flex;gap:10px;align-items:center">
          <button id="start-timer" class="btn primary">Commencer (chrono)</button>
          <button id="hear-tw" class="btn muted">Écouter</button>
          <div id="timer" style="margin-left:8px;font-weight:700;color:var(--muted)">00:00</div>
        </div>
        <div style="margin-top:12px"><button id="mark-good" class="btn primary">Bonne diction</button>
        <button id="mark-bad" class="btn muted">Réessayer</button></div>`;
      let startT=null, iv=null;
      function updateTimer(){ const ms = Date.now()-startT; const s = Math.floor(ms/1000); $('#timer').textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
      $('#hear-tw').addEventListener('click', ()=> speak(phrase));
      $('#start-timer').addEventListener('click', ()=>{
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
        startT = Date.now(); $('#timer').textContent = '00:00'; clearInterval(iv); iv = setInterval(updateTimer, 250);
        $('#start-timer').disabled = true;
        speak('Lis la phrase à haute voix maintenant');
      });
      $('#mark-good').addEventListener('click', ()=>{
        clearInterval(iv); $('#start-timer').disabled = false; session.count++; session.score++; playSuccess(); showFeedback('Très bon entraînement !', 'success'); speak('Bravo, bonne diction'); setTimeout(()=> renderGame(), 900);
      });
      $('#mark-bad').addEventListener('click', ()=>{
        clearInterval(iv); $('#start-timer').disabled = false; session.count++; playFail(); showFeedback('On reprend — tu peux réessayer.', 'fail'); speak('Essaie encore'); 
      });
    }

    // prev/next just rerender different item or close when done
    $('#btn-prev').onclick = () => { if(currentGame===1 || currentGame===3) { currentIndex = Math.max(0, currentIndex-1); } renderGame(); };
    $('#btn-next').onclick = () => { if(currentGame===1 || currentGame===3) { currentIndex++; } renderGame(); };
  }

  // Open / close modal & audio toggle
  function openGame(game){
    currentGame = game; currentIndex = 0; session = {score:0,count:0};
    $('#game-title').textContent = `Défi ${game}`;
    $('#game-modal').setAttribute('aria-hidden','false');
    renderGame();
    $('#game-body').focus();
  }
  function closeGame(){
    $('#game-modal').setAttribute('aria-hidden','true');
    // save results
    const all = load('labo_scores_v1') || {};
    const prev = all[currentGame] || {score:0,count:0};
    all[currentGame] = {score: prev.score + session.score, count: prev.count + session.count};
    save('labo_scores_v1', all);
    renderProgress();
    if(synth) synth.cancel();
  }

  // Attach event listeners after DOM ready
  function init(){
    // Start ambient if setting says so: postponed to first user gesture in many browsers
    if(settings.ambientOn && audioCtx){
      document.addEventListener('click', function once(){
        startAmbient(); document.removeEventListener('click', once);
      });
    }

    // Start/stop ambient toggle
    $('#btn-ambient-toggle').addEventListener('click', ()=>{
      if(!audioCtx) return alert('Audio Web not disponible dans ce navigateur');
      if(ambientRunning){ stopAmbient(); settings.ambientOn = false; $('#btn-ambient-toggle').textContent = '🔈'; }
      else { if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); startAmbient(); settings.ambientOn = true; $('#btn-ambient-toggle').textContent = '🔊'; }
      save(SETTINGS_KEY, settings);
    });

    // start buttons
    $$('.start-btn').forEach(b => b.addEventListener('click', e => { const g= Number(e.currentTarget.dataset.game); openGame(g); }));

    // modal controls
    $('#btn-close').addEventListener('click', closeGame);
    $('#btn-speak').addEventListener('click', ()=>{
      // read current screen text if any
      const bodyText = $('#game-body') ? $('#game-body').innerText : '';
      if(bodyText) speak(bodyText);
    });

    // initialize volumes from settings
    if(audioCtx){
      audio.sfxGain.gain.value = settings.sfxVolume ?? DEFAULTS.sfxVolume;
      audio.ambientGain.gain.value = settings.ambientVolume ?? DEFAULTS.ambientVolume;
    }

    // keyboard: Esc = close
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') {
        if($('#game-modal').getAttribute('aria-hidden') === 'false') closeGame();
      }
    });

    renderProgress();
  }

  // Wait DOM
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
