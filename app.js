const MAX_QUESTIONS = 10;
let currentGame = null;
let currentIndex = 0;
let sessionQuestions = [];
let answers = [];
let sessionScore = 0;

function normalize(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'fr-FR';
        msg.rate = 0.8;
        window.speechSynthesis.speak(msg);
    }
}

function openGame(id) {
    currentGame = id;
    const pool = [...gameData[`game${id}`]].sort(() => 0.5 - Math.random());
    sessionQuestions = pool.slice(0, MAX_QUESTIONS);
    answers = Array(MAX_QUESTIONS).fill(null);
    sessionScore = 0;
    currentIndex = 0;
    document.getElementById('modal').setAttribute('aria-hidden', 'false');
    render();
}

function closeGame() {
    document.getElementById('modal').setAttribute('aria-hidden', 'true');
    updateGlobalStats();
}

function render() {
    const body = document.getElementById('modal-body');
    const feedback = document.getElementById('feedback');
    feedback.textContent = '';
    
    if (currentIndex >= MAX_QUESTIONS) { showEnd(); return; }

    const q = sessionQuestions[currentIndex];
    document.getElementById('modal-title').textContent = `Défi ${currentGame} — Question ${currentIndex + 1} / ${MAX_QUESTIONS}`;
    updateScoreUI();

    const existing = answers[currentIndex];

    if (currentGame === 1) {
        body.innerHTML = `<p>${q.text.replace('___', '<strong>......</strong>')}</p>
            <input id="ans" class="input-field" placeholder="Ta réponse..." />
            <button class="btn primary" onclick="check1()">Valider</button>`;
    } else if (currentGame === 2) {
        body.innerHTML = `<p>${q.phrase}</p>` + q.reformulations.map(r => 
            `<button class="btn-choice" onclick="check2('${r.replace(/'/g, "\\'")}')">${r}</button>`).join('');
    } else if (currentGame === 3) {
        if (!existing || existing.phase !== 'input') {
            body.innerHTML = `<p>Mémorise ce mot :</p><h2 style="color:#6ee7b7; font-size:40px">${q.word}</h2>
                <button class="btn primary" onclick="startInput3()">J'ai mémorisé</button>`;
            speak(q.word);
        } else {
            body.innerHTML = `<p>Quel était le mot ?</p><input id="ans" class="input-field" />
                <button class="btn primary" onclick="check3()">Valider</button>`;
        }
    } else if (currentGame === 4) {
        body.innerHTML = `<p style="font-style:italic">"${q}"</p><p>Répète la phrase, puis valide :</p>
            <button class="btn primary" onclick="check4(true)">Réussi</button>
            <button class="btn muted" onclick="check4(false)">Difficile</button>`;
    }
}

function check1() {
    const val = document.getElementById('ans').value;
    const ok = normalize(val) === normalize(sessionQuestions[currentIndex].answer);
    finishQ(ok, val, sessionQuestions[currentIndex].answer);
}
function check2(choice) {
    const ok = choice === sessionQuestions[currentIndex].reformulations[0];
    finishQ(ok, choice, sessionQuestions[currentIndex].reformulations[0]);
}
function startInput3() { answers[currentIndex] = { phase: 'input' }; render(); }
function check3() {
    const val = document.getElementById('ans').value;
    const ok = normalize(val) === normalize(sessionQuestions[currentIndex].word);
    finishQ(ok, val, sessionQuestions[currentIndex].word);
}
function check4(ok) { finishQ(ok, ok ? 'Réussi' : 'Difficile', ''); }

function finishQ(ok, user, correct) {
    if (ok) sessionScore++;
    answers[currentIndex] = { answered: true, correct: ok };
    document.getElementById('feedback').textContent = ok ? "✅ Bravo !" : `❌ C'était : ${correct}`;
    setTimeout(() => { currentIndex++; render(); }, 1500);
}

function updateScoreUI() {
    document.getElementById('score-area').textContent = `Score : ${sessionScore} / ${MAX_QUESTIONS}`;
}

function goPrev() { if (currentIndex > 0) { currentIndex--; render(); } }
function goNext() { if (currentIndex < MAX_QUESTIONS - 1) { currentIndex++; render(); } }

function showEnd() {
    document.getElementById('modal-body').innerHTML = `<h2>Terminé !</h2><p>Ton score : ${sessionScore} / ${MAX_QUESTIONS}</p>
        <button class="btn primary" onclick="closeGame()">Retour au menu</button>`;
}

function updateGlobalStats() {
    const stats = JSON.parse(localStorage.getItem('ortho_stats') || '{"1":0,"2":0,"3":0,"4":0}');
    stats[currentGame] = Math.max(stats[currentGame], sessionScore);
    localStorage.setItem('ortho_stats', JSON.stringify(stats));
    loadStats();
}

function loadStats() {
    const stats = JSON.parse(localStorage.getItem('ortho_stats') || '{"1":0,"2":0,"3":0,"4":0}');
    document.getElementById('progress-list').innerHTML = [1,2,3,4].map(i => 
        `<div>Défi ${i}<br><b>${stats[i]}/10</b></div>`).join('');
}

window.onload = loadStats;
