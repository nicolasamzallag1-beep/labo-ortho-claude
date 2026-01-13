// app.js
(() => {
  const $ = (id) => document.getElementById(id);

  // Screens
  const screenHome = $("screenHome");
  const screenGame = $("screenGame");

  // Home
  const btnStart = $("btnStart");
  const btnMusicHome = $("btnMusicHome");

  // Game UI
  const elQuestion = $("question");
  const elAnswers = $("answers");
  const elScore = $("score");
  const elProgress = $("progress");
  const elTotal = $("total");
  const btnNext = $("btnNext");
  const btnRestart = $("btnRestart");
  const btnBackHome = $("btnBackHome");
  const btnMusic = $("btnMusic");
  const imgPhoto = $("photo");

  // Data
  const QUESTIONS = (window.QUESTIONS || []);
  let order = [];
  let idx = 0;
  let score = 0;
  let locked = false;

  // --------- Simple Music (WebAudio) ----------
  let audioCtx = null;
  let musicOn = false;
  let musicTimer = null;

  function setMusicLabel() {
    const label = musicOn ? "🎵 Musique : ON" : "🎵 Musique : OFF";
    btnMusic.textContent = label;
    btnMusicHome.textContent = label;
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTick(freq, duration = 0.08, type = "sine", gainVal = 0.02) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainVal, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function startMusicLoop() {
    stopMusicLoop();
    // petit pattern discret
    let step = 0;
    musicTimer = setInterval(() => {
      if (!musicOn) return;
      try {
        ensureAudio();
        const bass = [110, 110, 98, 110, 123, 110, 98, 110];
        const hat = [1,0,1,0,1,0,1,0];
        playTick(bass[step % bass.length], 0.09, "sine", 0.018);
        if (hat[step % hat.length]) playTick(880, 0.03, "square", 0.006);
        step++;
      } catch (e) {
        // si le navigateur refuse encore l'audio, on ne crash pas le jeu
      }
    }, 220);
  }

  function stopMusicLoop() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  function toggleMusic() {
    musicOn = !musicOn;
    setMusicLabel();
    if (musicOn) {
      ensureAudio();
      startMusicLoop();
    } else {
      stopMusicLoop();
    }
  }

  // --------- Game logic ----------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function initGame() {
    if (!QUESTIONS.length) {
      elQuestion.textContent = "Aucune question trouvée dans data.js";
      elAnswers.innerHTML = "";
      btnNext.disabled = true;
      return;
    }

    order = shuffle([...Array(QUESTIONS.length).keys()]);
    idx = 0;
    score = 0;
    locked = false;

    elTotal.textContent = QUESTIONS.length;
    elScore.textContent = score;
    renderQuestion();
  }

  function renderQuestion() {
    locked = false;
    btnNext.disabled = true;
    elAnswers.innerHTML = "";

    const q = QUESTIONS[order[idx]];
    elQuestion.textContent = q.text;

    // Photo (optionnelle)
    if (q.photo) {
      imgPhoto.src = q.photo;
      imgPhoto.classList.remove("hidden");
      imgPhoto.alt = "Illustration";
      // si l'image 404, on la cache au lieu de casser le jeu
      imgPhoto.onerror = () => {
        imgPhoto.classList.add("hidden");
        imgPhoto.removeAttribute("src");
      };
    } else {
      imgPhoto.classList.add("hidden");
      imgPhoto.removeAttribute("src");
    }

    elProgress.textContent = (idx + 1);

    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "answerBtn";
      btn.textContent = opt;
      btn.addEventListener("click", () => chooseAnswer(i));
      elAnswers.appendChild(btn);
    });
  }

  function chooseAnswer(chosenIndex) {
    if (locked) return;
    locked = true;

    const q = QUESTIONS[order[idx]];
    const correct = q.answerIndex;

    const buttons = [...elAnswers.querySelectorAll("button")];
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add("correct");
      if (i === chosenIndex && chosenIndex !== correct) b.classList.add("wrong");
    });

    if (chosenIndex === correct) {
      score += 1;
      elScore.textContent = score;
      // petit “ding”
      try {
        ensureAudio();
        playTick(660, 0.08, "sine", 0.02);
        playTick(990, 0.06, "sine", 0.015);
      } catch {}
      alert("✅ Bien joué !");
    } else {
      try {
        ensureAudio();
        playTick(220, 0.10, "sawtooth", 0.02);
      } catch {}
      alert("❌ Raté !");
    }

    btnNext.disabled = false;
  }

  function nextQuestion() {
    if (!locked) return; // pas de passage si pas de réponse
    idx += 1;

    if (idx >= QUESTIONS.length) {
      // Fin
      elQuestion.textContent = `🎉 Terminé ! Score final : ${score}/${QUESTIONS.length}`;
      elAnswers.innerHTML = "";
      btnNext.disabled = true;
      imgPhoto.classList.add("hidden");
      imgPhoto.removeAttribute("src");
      return;
    }

    renderQuestion();
  }

  function showHome() {
    screenGame.classList.add("hidden");
    screenHome.classList.remove("hidden");
  }

  function showGame() {
    screenHome.classList.add("hidden");
    screenGame.classList.remove("hidden");
  }

  // Events
  btnStart.addEventListener("click", () => {
    showGame();
    initGame();
  });

  btnRestart.addEventListener("click", () => initGame());
  btnNext.addEventListener("click", () => nextQuestion());
  btnBackHome.addEventListener("click", () => showHome());

  btnMusic.addEventListener("click", toggleMusic);
  btnMusicHome.addEventListener("click", toggleMusic);

  // On essaie d’autoriser l’audio dès le premier clic sur la page (utile iOS/Safari)
  document.addEventListener("click", () => {
    if (musicOn) {
      try { ensureAudio(); } catch {}
    }
  }, { once: false });

  // Start state
  setMusicLabel();
  showHome();
})();
