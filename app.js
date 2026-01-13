// app.js
// Logique principale du jeu

(() => {
  "use strict";

  // DOM Elements
  const screens = {
    onboarding: document.getElementById("onboarding"),
    menu: document.getElementById("menu"),
    settings: document.getElementById("settings"),
    game: document.getElementById("game"),
    pause: document.getElementById("pause-screen"),
    end: document.getElementById("end-screen"),
    dashboard: document.getElementById("dashboard"),
    about: document.getElementById("about"),
  };

  const startBtn = document.getElementById("start-btn");
  const aboutBtn = document.getElementById("about-btn");
  const aboutBackBtn = document.getElementById("about-back-btn");
  const dashboardBtn = document.getElementById("dashboard-btn");
  const dashboardBackBtn = document.getElementById("dashboard-back-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsBackBtn = document.getElementById("settingsBackBtn");
  const settingsForm = document.getElementById("settings-form");
  const audioToggleBtn = document.getElementById("audioToggle");
  const volumeRange = document.getElementById("volumeRange");
  const largeTextToggle = document.getElementById("largeTextToggle");
  const mouseOnlyToggle = document.getElementById("mouseOnlyToggle");
  const darkModeToggle = document.getElementById("darkModeToggle");

  const gameTitle = document.getElementById("game-title");
  const questionCounter = document.getElementById("question-counter");
  const scoreDisplay = document.getElementById("score-display");
  const timerDisplay = document.getElementById("timer-display");
  const gameContent = document.getElementById("game-content");
  const pauseBtn = document.getElementById("pause-btn");
  const quitBtn = document.getElementById("quit-btn");

  const pauseScreen = screens.pause;
  const resumeBtn = document.getElementById("resume-btn");
  const quitFromPauseBtn = document.getElementById("quit-from-pause-btn");

  const endScreen = screens.end;
  const finalScoreEl = document.getElementById("final-score");
  const finalFeedbackEl = document.getElementById("final-feedback");
  const replayBtn = document.getElementById("replay-btn");
  const backToMenuBtn = document.getElementById("back-to-menu-btn");

  const dashboardContent = document.getElementById("dashboard-content");

  // State
  let state = {
    currentScreen: "onboarding",
    currentEpreuve: null,
    difficulty: "facile",
    sessionLength: 10,
    largeText: false,
    mouseOnly: false,
    darkMode: false,
    audioOn: false,
    volume: 0.5,
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    streak: 0,
    timer: null,
    timerStart: null,
    timerDuration: 0,
    paused: false,
    sessionStartTime: null,
    sessionEndTime: null,
    history: [],
    seed: SEED_BASE,
  };

  // Audio context and sounds
  let audioCtx = null;
  let gainNode = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = state.volume;
      gainNode.connect(audioCtx.destination);
    }
  }

  function playSound(frequency = 440, duration = 0.15, type = "sine") {
    if (!state.audioOn) return;
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gainNode);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  // Background music (simple loop)
  let musicOsc = null;
  let musicInterval = null;

  function startMusic() {
    if (!state.audioOn) return;
    if (!audioCtx) initAudio();
    if (musicOsc) return; // already playing
    musicOsc = audioCtx.createOscillator();
    musicOsc.type = "triangle";
    musicOsc.frequency.value = 220;
    musicOsc.connect(gainNode);
    musicOsc.start();

    let freq = 220;
    musicInterval = setInterval(() => {
      freq += 20;
      if (freq > 440) freq = 220;
      musicOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }, 1000);
  }

  function stopMusic() {
    if (musicOsc) {
      musicOsc.stop();
      musicOsc.disconnect();
      musicOsc = null;
    }
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
  }

  // Save/load settings & history in localStorage
  function saveSettings() {
    const settings = {
      difficulty: state.difficulty,
      sessionLength: state.sessionLength,
      largeText: state.largeText,
      mouseOnly: state.mouseOnly,
      darkMode: state.darkMode,
      audioOn: state.audioOn,
      volume: state.volume,
      seed: state.seed,
    };
    localStorage.setItem("laboOrthoSettings", JSON.stringify(settings));
  }

  function loadSettings() {
    const settings = localStorage.getItem("laboOrthoSettings");
    if (settings) {
      try {
        const s = JSON.parse(settings);
        state.difficulty = s.difficulty || "facile";
        state.sessionLength = s.sessionLength || 10;
        state.largeText = s.largeText || false;
        state.mouseOnly = s.mouseOnly || false;
        state.darkMode = s.darkMode || false;
        state.audioOn = s.audioOn || false;
        state.volume = s.volume || 0.5;
        state.seed = s.seed || SEED_BASE;
      } catch {
        // ignore parse errors
      }
    }
  }

  function saveHistory() {
    localStorage.setItem("laboOrthoHistory", JSON.stringify(state.history));
  }

  function loadHistory() {
    const hist = localStorage.getItem("laboOrthoHistory");
    if (hist) {
      try {
        state.history = JSON.parse(hist);
      } catch {
        state.history = [];
      }
    }
  }

  // Navigation helpers
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      if (key === name) {
        screens[key].classList.add("active");
        screens[key].removeAttribute("hidden");
        screens[key].setAttribute("aria-hidden", "false");
      } else {
        screens[key].classList.remove("active");
        screens[key].setAttribute("hidden", "true");
        screens[key].setAttribute("aria-hidden", "true");
      }
    });
    state.currentScreen = name;
    // Focus first focusable element in screen
    setTimeout(() => {
      const screen = screens[name];
      const focusable = screen.querySelector(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) focusable.focus();
    }, 100);
  }

  // Reset game state for new session
  function resetSession(epreuve) {
    state.currentEpreuve = epreuve;
    state.currentQuestionIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.paused = false;
    state.sessionStartTime = Date.now();
    state.sessionEndTime = null;
    // Generate or load questions
    const key = `laboOrthoQuestions_ep${epreuve}_diff${state.difficulty}_seed${state.seed}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        state.questions = JSON.parse(saved);
      } catch {
        state.questions = generators[epreuve](state.seed);
        localStorage.setItem(key, JSON.stringify(state.questions));
      }
    } else {
      state.questions = generators[epreuve](state.seed);
      localStorage.setItem(key, JSON.stringify(state.questions));
    }
  }

  // Update UI for settings form
  function updateSettingsForm() {
    // Session length
    [...settingsForm.sessionLength].forEach((input) => {
      input.checked = input.value == state.sessionLength;
    });
    // Difficulty
    [...settingsForm.difficulty].forEach((input) => {
      input.checked = input.value === state.difficulty;
    });
    // Toggles
    largeTextToggle.checked = state.largeText;
    mouseOnlyToggle.checked = state.mouseOnly;
    darkModeToggle.checked = state.darkMode;
    audioToggleBtn.textContent = `Son : ${state.audioOn ? "On" : "Off"}`;
    audioToggleBtn.setAttribute("aria-pressed", state.audioOn ? "true" : "false");
    volumeRange.value = state.volume;
  }

  // Apply UI settings (dark mode, large text, mouse only)
  function applyUISettings() {
    document.body.classList.toggle("dark-mode", state.darkMode);
    document.body.classList.toggle("large-text", state.largeText);
  }

  // Audio toggle
  function toggleAudio() {
    state.audioOn = !state.audioOn;
    audioToggleBtn.textContent = `Son : ${state.audioOn ? "On" : "Off"}`;
    audioToggleBtn.setAttribute("aria-pressed", state.audioOn ? "true" : "false");
    if (state.audioOn) {
      startMusic();
    } else {
      stopMusic();
    }
  }

  // Volume change
  function changeVolume(value) {
    state.volume = value;
    if (gainNode) gainNode.gain.value = value;
  }

  // Render menu cards focus outline for keyboard navigation
  function setupMenuCards() {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const btn = card.querySelector(".play-btn");
          if (btn) btn.click();
        }
      });
    });
  }

  // Render question counter and score
  function updateGameInfo() {
    questionCounter.textContent = `Question ${state.currentQuestionIndex + 1} / ${state.sessionLength}`;
    scoreDisplay.textContent = `Score : ${state.score}`;
  }

  // Timer helpers
  function startTimer(durationSec, onTick, onEnd) {
    clearInterval(state.timer);
    state.timerDuration = durationSec * 1000;
    state.timerStart = Date.now();
    state.timer = setInterval(() => {
      if (state.paused) return;
      const elapsed = Date.now() - state.timerStart;
      const remaining = Math.max(0, state.timerDuration - elapsed);
      onTick(remaining);
      if (remaining <= 0) {
        clearInterval(state.timer);
        onEnd();
      }
    }, 100);
  }

  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
  }

  // Clear game content
  function clearGameContent() {
    gameContent.innerHTML = "";
  }

  // Show feedback message
  function showFeedback(message, isCorrect) {
    const fb = document.createElement("p");
    fb.className = "feedback";
    fb.textContent = message;
    if (isCorrect === true) fb.style.color = "#059669"; // green
    else if (isCorrect === false) fb.style.color = "#b91c1c"; // red
    gameContent.appendChild(fb);
  }

  // Handle answer selection for epreuve 1 & 2
  function handleAnswerSelection(selected, correct, explanation) {
    if (selected === correct) {
      state.score++;
      state.streak++;
      playSound(880, 0.15, "triangle");
      showFeedback("Bonne réponse ! " + explanation, true);
    } else {
      state.streak = 0;
      playSound(220, 0.3, "sawtooth");
      showFeedback(`Mauvaise réponse. ${explanation}`, false);
    }
  }

  // Render Epreuve 1 - Texte à trous
  function renderEpreuve1(item) {
    clearGameContent();
    gameTitle.textContent = "Épreuve 1 : Texte à trous";
    updateGameInfo();

    // Phrase avec trous
    const phraseEl = document.createElement("p");
    phraseEl.className = "phrase";
    phraseEl.textContent = item.phrase;
    gameContent.appendChild(phraseEl);

    // Pour chaque blank, afficher options
    item.blanks.forEach((blank) => {
      const optsData = item.optionsByBlank[blank];
      const optionsDiv = document.createElement("div");
      optionsDiv.className = "options";
      optionsDiv.setAttribute("role", "radiogroup");
      optionsDiv.setAttribute("aria-label", `Choix pour le mot manquant : ${blank}`);

      optsData.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt;
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-checked", "false");
        btn.addEventListener("click", () => {
          // Désactiver tous boutons
          [...optionsDiv.children].forEach((b) => {
            b.disabled = true;
            b.setAttribute("aria-checked", "false");
          });
          btn.setAttribute("aria-checked", "true");
          // Vérifier réponse
          handleAnswerSelection(opt, optsData.correct, optsData.explanation);
          // Passer à la question suivante après délai
          setTimeout(nextQuestion, 2500);
        });
        optionsDiv.appendChild(btn);
      });
      gameContent.appendChild(optionsDiv);
    });
  }

  // Render Epreuve 2 - Reformulation / Synonymes
  function renderEpreuve2(item) {
    clearGameContent();
    gameTitle.textContent = "Épreuve 2 : Reformulation / Synonymes";
    updateGameInfo();

    if (item.type === "synonyme") {
      const prompt = document.createElement("p");
      prompt.textContent = `Choisis le synonyme le plus proche de : "${item.word}"`;
      gameContent.appendChild(prompt);

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "options";
      optionsDiv.setAttribute("role", "radiogroup");
      optionsDiv.setAttribute("aria-label", `Choix du synonyme pour le mot ${item.word}`);

      item.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt;
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-checked", "false");
        btn.addEventListener("click", () => {
          [...optionsDiv.children].forEach((b) => {
            b.disabled = true;
            b.setAttribute("aria-checked", "false");
          });
          btn.setAttribute("aria-checked", "true");
          handleAnswerSelection(opt, item.correct, item.note);
          setTimeout(nextQuestion, 2500);
        });
        optionsDiv.appendChild(btn);
      });
      gameContent.appendChild(optionsDiv);
    } else if (item.type === "reformulation") {
      const prompt = document.createElement("p");
      prompt.textContent = `Choisis la meilleure reformulation de : "${item.phrase}"`;
      gameContent.appendChild(prompt);

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "options";
      optionsDiv.setAttribute("role", "radiogroup");
      optionsDiv.setAttribute("aria-label", `Choix de reformulation pour la phrase`);

      item.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt;
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-checked", "false");
        btn.addEventListener("click", () => {
          [...optionsDiv.children].forEach((b) => {
            b.disabled = true;
            b.setAttribute("aria-checked", "false");
          });
          btn.setAttribute("aria-checked", "true");
          const correctOpt = item.options[item.correct];
          handleAnswerSelection(opt, correctOpt, item.note);
          setTimeout(nextQuestion, 2500);
        });
        optionsDiv.appendChild(btn);
      });
      gameContent.appendChild(optionsDiv);
    }
  }

  // Render Epreuve 3 - Mémoire de phrases
  function renderEpreuve3(item) {
    clearGameContent();
    gameTitle.textContent = "Épreuve 3 : Mémoire de phrases";
    updateGameInfo();

    // Afficher phrase pendant 8 secondes, puis cacher et proposer mots mélangés à cliquer dans l'ordre
    const phraseEl = document.createElement("p");
    phraseEl.className = "phrase";
    phraseEl.textContent = item.phrase;
    gameContent.appendChild(phraseEl);

    const infoEl = document.createElement("p");
    infoEl.textContent = "Mémorisez la phrase...";
    gameContent.appendChild(infoEl);

    // Après délai, cacher phrase et afficher mots mélangés
    setTimeout(() => {
      phraseEl.style.display = "none";
      infoEl.textContent = "Cliquez les mots dans le bon ordre";

      const wordsContainer = document.createElement("div");
      wordsContainer.className = "options";
      wordsContainer.setAttribute("aria-label", "Mots mélangés à cliquer dans l’ordre");

      const selectedWords = [];

      function renderSelected() {
        const selectedDiv = document.getElementById("selected-words");
        if (selectedDiv) selectedDiv.remove();
        const div = document.createElement("div");
        div.id = "selected-words";
        div.style.marginTop = "1rem";
        div.style.minHeight = "2rem";
        div.textContent = "Phrase reconstruite : " + selectedWords.join(" ");
        gameContent.appendChild(div);
      }

      item.shuffledWords.forEach((word) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = word;
        btn.setAttribute("type", "button");
        btn.addEventListener("click", () => {
          if (selectedWords.length >= item.words.length) return;
          selectedWords.push(word);
          btn.disabled = true;
          renderSelected();
          if (selectedWords.length === item.words.length) {
            // Vérifier réponse
            let correct = true;
            for (let i = 0; i < item.words.length; i++) {
              if (selectedWords[i] !== item.words[i]) {
                correct = false;
                break;
              }
            }
            if (correct) {
              state.score++;
              state.streak++;
              playSound(880, 0.15, "triangle");
              showFeedback("Bravo, phrase correcte !", true);
            } else {
              state.streak = 0;
              playSound(220, 0.3, "sawtooth");
              showFeedback(
                `Phrase correcte : "${item.phrase}"`,
                false
              );
            }
            setTimeout(nextQuestion, 3500);
          }
        });
        wordsContainer.appendChild(btn);
      });
      gameContent.appendChild(wordsContainer);
      renderSelected();
    }, 8000);
  }

  // Render Epreuve 4 - Vitesse & articulation
  function renderEpreuve4(item) {
    clearGameContent();
    gameTitle.textContent = "Épreuve 4 : Vitesse & articulation";
    updateGameInfo();

    const phraseEl = document.createElement("p");
    phraseEl.className = "phrase";
    phraseEl.textContent = item.phrase;
    gameContent.appendChild(phraseEl);

    // Minuteur doux 15 secondes
    let timeLeft = 15;
    timerDisplay.textContent = `Temps restant : ${timeLeft}s`;

    const timerInterval = setInterval(() => {
      if (state.paused) return;
      timeLeft--;
      timerDisplay.textContent = `Temps restant : ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = "";
        showSelfEval();
      }
    }, 1000);

    // Bouton "J’ai lu"
    const readBtn = document.createElement("button");
    readBtn.className = "btn primary";
    readBtn.textContent = "J’ai lu";
    readBtn.setAttribute("aria-label", "J’ai lu la phrase");
    readBtn.addEventListener("click", () => {
      clearInterval(timerInterval);
      timerDisplay.textContent = "";
      showSelfEval();
    });
    gameContent.appendChild(readBtn);

    function showSelfEval() {
      readBtn.disabled = true;
      // Auto-évaluation 1-5
      const evalLabel = document.createElement("p");
      evalLabel.textContent = "Comment évalues-tu la lecture ?";
      gameContent.appendChild(evalLabel);

      const evalDiv = document.createElement("div");
      evalDiv.className = "options";
      evalDiv.setAttribute("role", "radiogroup");
      evalDiv.setAttribute("aria-label", "Auto-évaluation de la lecture");

      const evalOptions = [
        { val: 1, label: "Très difficile" },
        { val: 2, label: "Difficile" },
        { val: 3, label: "OK" },
        { val: 4, label: "Facile" },
        { val: 5, label: "Très facile" },
      ];

      let selectedEval = null;

      evalOptions.forEach(({ val, label }) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = label;
        btn.setAttribute("type", "button");
        btn.addEventListener("click", () => {
          selectedEval = val;
          [...evalDiv.children].forEach((b) => {
            b.disabled = true;
          });
          btn.disabled = false;
          // Question de compréhension QCM
          showComprehensionQuestion();
        });
        evalDiv.appendChild(btn);
      });
      gameContent.appendChild(evalDiv);

      function showComprehensionQuestion() {
        const q = item.question;
        const qEl = document.createElement("p");
        qEl.textContent = q.q;
        gameContent.appendChild(qEl);

        const qDiv = document.createElement("div");
        qDiv.className = "options";
        qDiv.setAttribute("role", "radiogroup");
        qDiv.setAttribute("aria-label", "Question de compréhension");

        q.options.forEach((opt, idx) => {
          const btn = document.createElement("button");
          btn.className = "option-btn";
          btn.textContent = opt;
          btn.setAttribute("type", "button");
          btn.addEventListener("click", () => {
            [...qDiv.children].forEach((b) => {
              b.disabled = true;
            });
            btn.disabled = false;
            // Calcul score
            if (idx === q.correct) {
              state.score++;
              if (selectedEval >= 3) state.score++; // bonus assiduité léger
              playSound(880, 0.15, "triangle");
              showFeedback("Bonne réponse et merci pour ton évaluation !", true);
            } else {
              playSound(220, 0.3, "sawtooth");
              showFeedback("Réponse incorrecte, mais bravo pour l’effort !", false);
            }
            setTimeout(nextQuestion, 3500);
          });
          qDiv.appendChild(btn);
        });
        gameContent.appendChild(qDiv);
      }
    }
  }

  // Render current question based on epreuve
  function renderCurrentQuestion() {
    if (state.currentQuestionIndex >= state.sessionLength) {
      endSession();
      return;
    }
    const item = state.questions[state.currentQuestionIndex];
    switch (state.currentEpreuve) {
      case 1:
        renderEpreuve1(item);
        break;
      case 2:
        renderEpreuve2(item);
        break;
      case 3:
        renderEpreuve3(item);
        break;
      case 4:
        renderEpreuve4(item);
        break;
      default:
        console.error("Épreuve inconnue");
    }
  }

  // Passer à la question suivante
  function nextQuestion() {
    state.currentQuestionIndex++;
    updateGameInfo();
    renderCurrentQuestion();
  }

  // Fin de session
  function endSession() {
    stopTimer();
    state.sessionEndTime = Date.now();
    showScreen("end");
    finalScoreEl.textContent = `Ton score : ${state.score} / ${state.sessionLength}`;
    finalFeedbackEl.textContent = getFinalFeedback(state.score, state.sessionLength);

    // Sauvegarder dans l’historique
    const durationSec = Math.round((state.sessionEndTime - state.sessionStartTime) / 1000);
    const sessionRecord = {
      date: new Date().toISOString(),
      epreuve: state.currentEpreuve,
      score: state.score,
      length: state.sessionLength,
      duration: durationSec,
      difficulty: state.difficulty,
    };
    state.history.unshift(sessionRecord);
    if (state.history.length > 10) state.history.pop();
    saveHistory();
  }

  function getFinalFeedback(score, total) {
    const ratio = score / total;
    if (ratio === 1) return "Parfait ! Tu es un champion, Claude ! 🎉";
    if (ratio >= 0.8) return "Très bien joué, continue comme ça !";
    if (ratio >= 0.5) return "Pas mal, un peu plus d’entraînement et ça ira mieux.";
    return "Ne te décourage pas, chaque effort compte !";
  }

  // Réinitialiser questions (nouveau seed)
  function resetQuestions() {
    state.seed = Math.floor(Math.random() * 1000000);
    const key = `laboOrthoQuestions_ep${state.currentEpreuve}_diff${state.difficulty}_seed${state.seed}`;
    localStorage.removeItem(key);
    resetSession(state.currentEpreuve);
  }

  // Afficher tableau de bord
  function renderDashboard() {
    dashboardContent.innerHTML = "";
    if (state.history.length === 0) {
      dashboardContent.textContent = "Aucune session jouée pour le moment.";
      return;
    }
    // Meilleurs scores par épreuve
    const bestScores = {};
    state.history.forEach((s) => {
      if (!bestScores[s.epreuve] || s.score > bestScores[s.epreuve].score) {
        bestScores[s.epreuve] = s;
      }
    });

    const bestScoresTable = document.createElement("table");
    const headerRow = document.createElement("tr");
    ["Épreuve", "Meilleur score", "Difficulté", "Date"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    });
    bestScoresTable.appendChild(headerRow);

    for (let ep = 1; ep <= 4; ep++) {
      const row = document.createElement("tr");
      const epName = {
        1: "Texte à trous",
        2: "Reformulation / Synonymes",
        3: "Mémoire de phrases",
        4: "Vitesse & articulation",
      }[ep];
      const best = bestScores[ep];
      const dateStr = best ? new Date(best.date).toLocaleDateString() : "-";
      const scoreStr = best ? `${best.score} / ${best.length}` : "-";
      const diffStr = best ? best.difficulty : "-";

      [epName, scoreStr, diffStr, dateStr].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
      });
      bestScoresTable.appendChild(row);
    }
    dashboardContent.appendChild(bestScoresTable);

    // Dernières sessions
    const recentTitle = document.createElement("h3");
    recentTitle.textContent = "Dernières sessions";
    dashboardContent.appendChild(recentTitle);

    const recentTable = document.createElement("table");
    const recentHeader = document.createElement("tr");
    ["Date", "Épreuve", "Score", "Durée (s)", "Difficulté"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      recentHeader.appendChild(th);
    });
    recentTable.appendChild(recentHeader);

    state.history.slice(0, 10).forEach((s) => {
      const row = document.createElement("tr");
      const epName = {
        1: "Texte à trous",
        2: "Reformulation / Synonymes",
        3: "Mémoire de phrases",
        4: "Vitesse & articulation",
      }[s.epreuve];
      const dateStr = new Date(s.date).toLocaleString();
      [dateStr, epName, `${s.score} / ${s.length}`, s.duration, s.difficulty].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
      });
      recentTable.appendChild(row);
    });
    dashboardContent.appendChild(recentTable);
  }

  // Event listeners

  startBtn.addEventListener("click", () => {
    showScreen("menu");
  });

  aboutBtn.addEventListener("click", () => {
    showScreen("about");
  });

  aboutBackBtn.addEventListener("click", () => {
    showScreen("onboarding");
  });

  dashboardBtn.addEventListener("click", () => {
    renderDashboard();
    showScreen("dashboard");
  });

  dashboardBackBtn.addEventListener("click", () => {
    showScreen("menu");
  });

  settingsBtn.addEventListener("click", () => {
    updateSettingsForm();
    showScreen("settings");
  });

  settingsBackBtn.addEventListener("click", () => {
    showScreen("menu");
  });

  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(settingsForm);
    state.sessionLength = parseInt(formData.get("sessionLength"), 10);
    state.difficulty = formData.get("difficulty");
    state.largeText = largeTextToggle.checked;
    state.mouseOnly = mouseOnlyToggle.checked;
    state.darkMode = darkModeToggle.checked;
    saveSettings();
    applyUISettings();
    showScreen("menu");
  });

  audioToggleBtn.addEventListener("click", () => {
    toggleAudio();
    saveSettings();
  });

  volumeRange.addEventListener("input", (e) => {
    changeVolume(parseFloat(e.target.value));
    saveSettings();
  });

  // Jouer à une épreuve
  document.querySelectorAll(".play-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const epreuve = parseInt(btn.closest(".card").dataset.epreuve, 10);
      resetSession(epreuve);
      updateGameInfo();
      renderCurrentQuestion();
      showScreen("game");
    });
  });

  pauseBtn.addEventListener("click", () => {
    state.paused = true;
    showScreen("pause");
  });

  resumeBtn.addEventListener("click", () => {
    state.paused = false;
    showScreen("game");
  });

  quitBtn.addEventListener("click", () => {
    if (confirm("Veux-tu vraiment quitter cette épreuve ? Ta progression sera perdue.")) {
      showScreen("menu");
    }
  });

  quitFromPauseBtn.addEventListener("click", () => {
    if (confirm("Veux-tu vraiment quitter cette épreuve ? Ta progression sera perdue.")) {
      state.paused = false;
      showScreen("menu");
    }
  });

  replayBtn.addEventListener("click", () => {
    resetSession(state.currentEpreuve);
    state.sessionLength = 10;
    updateGameInfo();
    renderCurrentQuestion();
    showScreen("game");
  });

  backToMenuBtn.addEventListener("click", () => {
    showScreen("menu");
  });

  // Keyboard navigation global
  document.addEventListener("keydown", (e) => {
    if (state.currentScreen === "game") {
      if (e.key === "Escape") {
        e.preventDefault();
        pauseBtn.click();
      }
    } else if (state.currentScreen === "pause") {
      if (e.key === "Escape") {
        e.preventDefault();
        resumeBtn.click();
      }
    }
  });

  // Initial setup
  function init() {
    loadSettings();
    loadHistory();
    applyUISettings();
    if (state.audioOn) startMusic();
    updateSettingsForm();
    setupMenuCards();
    showScreen("onboarding");
  }

  init();
})();