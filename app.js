(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } };

  function normalize(s){ return (s||"").toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g,"").trim(); }
  function levenshtein(a,b){
    if(!a||!b) return (a||"").length + (b||"").length;
    const m=a.length, n=b.length;
    const d = Array.from({length:m+1}, ()=> Array(n+1).fill(0));
    for(let i=0;i<=m;i++) d[i][0]=i;
    for(let j=0;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost = a[i-1]===b[j-1]?0:1; d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost); } }
    return d[m][n];
  }

  function showFeedback(text, type='success'){
    const box = $('#feedback');
    box.innerHTML = `<div class="feedback ${type}">${text}</div>`;
    setTimeout(()=> { if (box.firstChild) box.firstChild.classList.add(type==='success' ? 'correct' : 'incorrect'); }, 30);
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  const audio = { master: null, ambientGain: null, sfxGain: null, ambientNodes: [] };
  if(audioCtx){
    audio.master = audioCtx.createGain(); audio.ambientGain = audioCtx.createGain(); audio.sfxGain = audioCtx.createGain();
    audio.ambientGain.connect(audio.master); audio.sfxGain.connect(audio.master); audio.master.connect(audioCtx.destination);
    audio.ambientGain.gain.value = 0.15; audio.sfxGain.gain.value = 0.6;
  }

  let ambientRunning = false;
  function startAmbient(){
    if(!audioCtx || ambientRunning) return;
    const o1 = audioCtx.createOscillator(); o1.frequency.value = 70;
    const filter = audioCtx.createBiquadFilter(); filter.frequency.value = 800;
    o1.connect(filter); filter.connect(audio.ambientGain);
    o1.start(); audio.ambientNodes = [o1, filter]; ambientRunning = true;
  }
  function stopAmbient(){ audio.ambientNodes.forEach(n=>{ try{n.stop(); n.disconnect();}catch(e){} }); ambientRunning = false; }
  function playSfx(isSuccess){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(); o.frequency.value = isSuccess ? 600 : 200;
    const g = audioCtx.createGain(); o.connect(g); g.connect(audio.sfxGain);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    o.start(); o.stop(audioCtx.currentTime + 0.4);
  }

  const synth = window.speechSynthesis;
  function speak(text){ if(!synth) return; synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 0.9; synth.speak(u); }

  let currentGame = null, currentIndex = 0, session = {score:0,count:0};

  function renderGame(){
    const body = $('#game-body');
    body.innerHTML = ''; $('#feedback').innerHTML = '';
    const data = gameData[`game${currentGame}`];
    const item = data[currentIndex % data.length];

    if(currentGame === 1){
      body.innerHTML = `<p>${item.text.replace('___','___')}</p><input id="fill-in" class="input"><button id="val" class="btn primary">Valider</button>`;
      $('#val').onclick = () => {
        const v = normalize($('#fill-in').value);
        session.count++;
        if(v === normalize(item.answer)){ session.score++; playSfx(true); showFeedback('Bravo !', 'success'); }
        else { playSfx(false); showFeedback(`Non : ${item.answer}`, 'fail'); }
        currentIndex++; setTimeout(renderGame, 1500);
      };
    } else if(currentGame === 2){
      body.innerHTML = `<p>${item.phrase}</p>` + item.reformulations.map(r => `<button class="btn muted ref-btn">${r}</button>`).join('');
      $$('.ref-btn').forEach(b => b.onclick = () => {
        session.count++;
        if(b.innerText === item.reformulations[0]){ session.score++; playSfx(true); showFeedback('Oui !', 'success'); }
        else { playSfx(false); showFeedback('Non', 'fail'); }
        setTimeout(renderGame, 1500);
      });
    } else if(currentGame === 3 || currentGame === 4){
      body.innerHTML = `<p>${item}</p><button id="next-item" class="btn primary">Suivant</button>`;
      $('#next-item').onclick = () => { currentIndex++; renderGame(); };
    }
  }

  function init(){
    $$('.start-btn').forEach(b => b.onclick = () => {
      currentGame = parseInt(b.dataset.game); currentIndex = 0;
      $('#game-modal').setAttribute('aria-hidden', 'false');
      renderGame();
    });
    $('#btn-close').onclick = () => $('#game-modal').setAttribute('aria-hidden', 'true');
    $('#btn-ambient-toggle').onclick = () => {
      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if(ambientRunning) { stopAmbient(); $('#btn-ambient-toggle').innerText = '🔈'; }
      else { startAmbient(); $('#btn-ambient-toggle').innerText = '🔊'; }
    };
    $('#btn-speak').onclick = () => speak($('#game-body').innerText);
    
    const scores = load('scores') || {1:0,2:0,3:0,4:0};
    $('#progress-list').innerText = "Prêt à jouer !";
  }
  init();
})();
