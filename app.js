(() => {
  const $ = (id) => document.getElementById(id);

  const elQuestion = $("question");
  const elAnswers  = $("answers");
  const elScore    = $("score");
  const elProgress = $("progress");
  const elTotal    = $("total");
  const elPhoto    = $("photo");

  const btnNext    = $("btnNext");
  const btnRestart = $("btnRestart");
  const btnMusic   = $("btnMusic");

  // --- State ---
  let questions = [];
  let index = 0;
  let score = 0;
  let locked = false;

  // --- Audio (sans fichiers, via WebAudio) ---
  let audioOn = false;
  let ctx = null;
  let osc = null;
  let gain = null;

  function startMusic(){
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();

    if (osc) return;
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;        // note grave
    gain.gain.value = 0.02;           // volume très bas

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    audioOn = true;
    btnMusic.textContent = "🎵 Musique : ON";
  }

  function stopMusic(){
    if (osc) { osc.stop(); osc.disconnect(); osc = null; }
    if (gain){ gain.disconnect(); gain = null; }
    audioOn = false;
    btnMusic.textContent = "🎵 Musique : OFF";
  }

  function blip(ok){
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = ok ? 660 : 220;
    g.gain.value = 0.06;

    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  }

  // --- Utils ---
  function shuffle(arr){
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setPhoto(src){
    if (src){
      elPhoto.src = src;
      elPhoto.style.display = "block";
    } else {
      elPhoto.removeAttribute("src");
      elPhoto.style.display = "none";
    }
  }

  // --- Render ---
  function render(){
    const q = questions[index];
    locked = false;
    btnNext.disabled = true;

    elQuestion.textContent = q.question;
    setPhoto(q.image || "");

    elProgress.textContent = String(index + 1);
    elTotal.textContent = String(questions.length);
    elScore.textContent = String(score);

    elAnswers.innerHTML = "";
    q.answers.forEach((txt, i) => {
      const b = document.createElement("button");
      b.className = "answer";
      b.textContent = txt;
      b.addEventListener("click", () => choose(i, b));
      elAnswers.appendChild(b);
    });
  }

  function choose(i, btn){
    if (locked) return;
    locked = true;

    const q = questions[index];
    const buttons = [...elAnswers.querySelectorAll(".answer")];

    // lock all
    buttons.forEach(b => b.disabled = true);

    // mark
    const ok = i === q.correctIndex;
    if (ok) score += 1;

    buttons[q.correctIndex]?.classList.add("good");
    if (!ok) btn.classList.add("bad");

    elScore.textContent = String(score);

    // sound feedback
    if (ctx && audioOn) blip(ok);

    btnNext.disabled = false;
    btnNext.focus();
  }

  function next(){
    if (index < questions.length - 1){
      index += 1;
      render();
      return;
    }
    // End screen
    elQuestion.textContent = `Terminé ✅ Score : ${score}/${questions.length}`;
    setPhoto("");
    elAnswers.innerHTML = `<div style="color:#94a3b8;line-height:1.5">
      Tu veux une version <b>plus fun</b> (inventaire, bonus, musique clubbing, photos, etc.) ? 😄
    </div>`;
    btnNext.disabled = true;
  }

  function restart(){
    score = 0;
    index = 0;
    questions = shuffle(window.QUESTIONS || []);
    if (!questions.length){
      elQuestion.textContent = "Erreur : aucune question trouvée. Vérifie data.js (window.QUESTIONS).";
      return;
    }
    render();
  }

  // --- Events ---
  btnNext.addEventListener("click", next);
  btnRestart.addEventListener("click", restart);
  btnMusic.addEventListener("click", () => {
    // l'audio nécessite un geste utilisateur : c'est OK ici
    if (!audioOn) startMusic();
    else stopMusic();
  });

  // --- Boot ---
  window.addEventListener("DOMContentLoaded", () => {
    questions = shuffle(window.QUESTIONS || []);
    if (!questions.length){
      elQuestion.textContent = "Erreur : data.js ne charge pas. Vérifie qu'il est bien au même niveau que index.html.";
      return;
    }
    render();
  });
})();
