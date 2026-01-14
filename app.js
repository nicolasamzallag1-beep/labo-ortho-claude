/* app.js — Labo Ortho (version finale avec TTS pour jeu 3)
   - Navigation Prev / Next fonctionnelle
   - Score partie + score global (localStorage)
   - Fin de partie = 10 questions
   - Jeu 3 : Mémoire Flash interactif + synthèse vocale (TTS)
   - Sons simples via WebAudio (fallback silencieux si bloqué)
*/

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* CONFIG */
const MAX_QUESTIONS = 10;

/* SESSION */
let currentGame = null;
let currentIndex = 0;
let sessionQuestions = [];    // tableaux des questions sélectionnées pour la partie
let answers = [];             // { answered: bool, user: string, correct: bool }
let sessionScore = 0;

/* GLOBAL STATS */
const STORAGE_KEY_GLOBAL = 'labo_claude_global';
let globalStats = loadGlobalStats();

/* utilitaires */
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()* (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function normalizeText(s){
  return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,'').trim();
}

/* sons simples */
function playTone(type){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if(type === 'success'){
      o.type = 'sine';
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    } else {
      o.type = 'square';
      o.frequency.value = 220;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.30);
    }
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch(e){
    // pas de son possible -> silencieux
  }
}

/* TTS pour jeu 3 */
function speakWord(word){
  if(!('speechSynthesis' in window)) return; // pas supporté
  window.speechSynthesis.cancel(); // stoppe toute synthèse en cours
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.9; // vitesse un peu ralentie pour mieux comprendre
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

/* global storage */
function loadGlobalStats(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GLOBAL);
    if(raw) return JSON.parse(raw);
  } catch(e){}
  return { totals: {1:0,2:0,3:0,4:0}, attempts: {1:0,2:0,3:0,4:0} };
}
function saveGlobalStats(){
  try { localStorage.setItem(STORAGE_KEY_GLOBAL, JSON.stringify(globalStats)); } catch(e){}
}

/* UI update */
function updateProgressUI(){
  const container = $('#progress-list');
  container.innerHTML = '';
  for(let i=1;i<=4;i++){
    const pct = globalStats.attempts[i] ? Math.round(100 * globalStats.totals[i] / globalStats.attempts[i]) : 0;
    const div = document.createElement('div');
    div.innerHTML = `<strong>Défi ${i}</strong><div style="font-size:13px;color:var(--muted)">${pct}% — ${globalStats.attempts[i]} pts</div>`;
    container.appendChild(div);
  }
}

/* open / close game */
function openGame(gameId){
  if(!gameData || !gameData[`game${gameId}`]){ alert("Données de jeu introuvables."); return; }
  currentGame = Number(gameId);
  // sélection aléatoire de MAX_QUESTIONS éléments
  const pool = shuffle(gameData[`game${currentGame}`]);
  sessionQuestions = pool.slice(0, MAX_QUESTIONS);
  answers = Array(MAX_QUESTIONS).fill(null);
  sessionScore = 0;
  currentIndex = 0;
  $('#modal').setAttribute('aria-hidden','false');
  renderCurrent();
  updateScoreArea();
}

/* close */
function closeGame(save=true){
  $('#modal').setAttribute('aria-hidden','true');
  if(save && currentGame){
    globalStats.totals[currentGame] += sessionScore;
    globalStats.attempts[currentGame] += MAX_QUESTIONS;
    saveGlobalStats();
    updateProgressUI();
  }
}

/* render question according to currentGame & currentIndex */
function renderCurrent(){
  const body = $('#modal-body');
  const feedback = $('#feedback');
  feedback.textContent = '';
  if(!sessionQuestions || sessionQuestions.length === 0){
    body.innerHTML = '<p>Aucune question.</p>';
    return;
  }

  // if finishing conditions: when all answered
  const answeredCount = answers.filter(a => a !== null && a.answered).length;
  if(answeredCount >= MAX_QUESTIONS){
    showEndScreen();
    return;
  }

  const q = sessionQuestions[currentIndex];
  const qNum = currentIndex + 1;
  $('#modal-title').textContent = `Défi ${currentGame} — Question ${qNum} / ${MAX_QUESTIONS}`;
  updateScoreArea();

  // If this question already answered, display result & allow navigation
  const existing = answers[currentIndex];
  if(currentGame === 1){
    // Texte à trous
    if(existing && existing.answered){
      body.innerHTML = `<p style="font-size:1.15rem">${q.text.replace('___','<strong>______</strong>')}</p>
        <p><strong>Ta réponse :</strong> ${existing.user || '—'}</p>
        <p style="color:${existing.correct? '#64ffda' : '#ff6b6b'};">${existing.correct? 'Bonne réponse' : 'Réponse correcte : ' + q.answer}</p>`;
      return;
    }
    body.innerHTML = `
      <p style="font-size:1.2rem">${q.text.replace('___','<strong>______</strong>')}</p>
      <input id="input-answer" class="input-field" placeholder="Écris ta réponse ici" autocomplete="off" />
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="btn-validate" class="btn primary">Valider</button>
        <button id="btn-skip" class="btn muted">Passer</button>
      </div>
    `;
    $('#input-answer').focus();
    $('#btn-validate').onclick = () => {
      const val = normalizeText($('#input-answer').value);
      const correct = normalizeText(q.answer);
      const isCorrect = val === correct;
      answers[currentIndex] = { answered:true, user: $('#input-answer').value.trim(), correct: isCorrect };
      if(isCorrect){ sessionScore++; playTone('success'); $('#feedback').textContent = 'Bravo !'; }
      else { playTone('fail'); $('#feedback').textContent = `Réponse : ${q.answer}`; }
      updateScoreArea();
      setTimeout(() => { // auto advance to next unanswered or end
        moveToNextUnanswered();
      }, 900);
    };
    $('#btn-skip').onclick = () => {
      answers[currentIndex] = { answered:true, user:'', correct:false };
      playTone('fail'); $('#feedback').textContent = `Passé — réponse : ${q.answer}`;
      updateScoreArea();
      setTimeout(()=> moveToNextUnanswered(), 700);
    };

  } else if(currentGame === 2){
    // Reformulation (q.reformulations[0] = correct)
    if(existing && existing.answered){
      body.innerHTML = `<p style="font-size:1.15rem">${q.phrase}</p>
        <p><strong>Ta réponse :</strong> ${existing.user || '—'}</p>
        <p style="color:${existing.correct? '#64ffda' : '#ff6b6b'};">${existing.correct? 'Bonne reformulation' : 'Réponse correcte : ' + q.reformulations[0]}</p>`;
      return;
    }
    body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:12px">${q.phrase}</p>`;
    const choices = shuffle(q.reformulations.slice());
    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'btn-choice';
      btn.textContent = choice;
      btn.onclick = () => {
        const ok = choice === q.reformulations[0];
        answers[currentIndex] = { answered:true, user: choice, correct: ok };
        if(ok){ sessionScore++; playTone('success'); $('#feedback').textContent = 'Exact !'; }
        else { playTone('fail'); $('#feedback').textContent = 'Mauvaise réponse.'; }
        updateScoreArea();
        setTimeout(()=> moveToNextUnanswered(), 900);
      };
      body.appendChild(btn);
    });

  } else if(currentGame === 3){
    // Mémoire Flash : phase 1 show word, user clicks "J'ai mémorisé", word disparaît, puis input
    if(existing && existing.answered){
      body.innerHTML = `<p style="font-size:1.15rem">Mot mémorisé : <strong>${sessionQuestions[currentIndex].word}</strong></p>
        <p>Ta réponse : ${existing.user || '—'}</p>
        <p style="color:${existing.correct? '#64ffda' : '#ff6b6b'};">${existing.correct? 'Exact !' : 'Mot attendu : ' + sessionQuestions[currentIndex].word}</p>`;
      return;
    }

    // If we stored a phase state, show restitution; otherwise show flash
    if(!answers[currentIndex] || answers[currentIndex].phase !== 'rest'){
      // show the word big, ask to click when memorized
      body.innerHTML = `<p>Mémorisez ce mot :</p>
        <h2 style="font-size:2.4rem;color:var(--accent)">${q.word}</h2>
        <div style="margin-top:12px"><button id="btn-memorized" class="btn primary">J'ai mémorisé</button></div>
        <p style="color:var(--muted);margin-top:12px;font-size:13px">Astuce : regarde le mot 2-3 secondes, puis clique.</p>`;
      // lance la synthèse vocale
      speakWord(q.word);
      $('#btn-memorized').onclick = () => {
        answers[currentIndex] = { answered:false, phase:'rest' }; // now restitution phase
        renderCurrent();
      };
    } else {
      // restitution phase
      body.innerHTML = `<p>Écris le mot que tu as mémorisé :</p>
        <input id="input-answer" class="input-field" placeholder="Écris le mot ici" autocomplete="off" />
        <div style="display:flex;gap:10px">
          <button id="btn-validate" class="btn primary">Valider</button>
          <button id="btn-skip" class="btn muted">Passer</button>
        </div>`;
      $('#input-answer').focus();
      $('#btn-validate').onclick = () => {
        const val = normalizeText($('#input-answer').value);
        const core = normalizeText(q.word);
        const ok = val === core;
        answers[currentIndex] = { answered:true, user: $('#input-answer').value.trim(), correct: ok };
        if(ok){ sessionScore++; playTone('success'); $('#feedback').textContent = 'Parfait !'; }
        else { playTone('fail'); $('#feedback').textContent = `C'était : ${q.word}`; }
        updateScoreArea();
        setTimeout(()=> moveToNextUnanswered(), 900);
      };
      $('#btn-skip').onclick = () => {
        answers[currentIndex] = { answered:true, user: '', correct:false };
        playTone('fail'); $('#feedback').textContent = `Passé — mot : ${q.word}`;
        updateScoreArea();
        setTimeout(()=> moveToNextUnanswered(), 700);
      };
    }

  } else if(currentGame === 4){
    // Articulation : user marks success or difficulty
    if(existing && existing.answered){
      body.innerHTML = `<p style="font-size:1.15rem">${q}</p>
        <p>Ta note : ${existing.correct ? 'Réussi' : 'Difficile'}</p>`;
      return;
    }
    body.innerHTML = `<p style="font-size:1.15rem;margin-bottom:12px">${q}</p>
      <p>Répète 3 fois à voix haute, puis choisis :</p>
      <div style="display:flex;gap:10px">
        <button id="btn-good" class="btn primary">Réussi</button>
        <button id="btn-bad" class="btn muted">Difficile</button>
      </div>`;
    $('#btn-good').onclick = () => {
      answers[currentIndex] = { answered:true, user:'Réussi', correct:true };
      sessionScore++; playTone('success'); $('#feedback').textContent = 'Bravo !';
      updateScoreArea();
      setTimeout(()=> moveToNextUnanswered(), 700);
    };
    $('#btn-bad').onclick = () => {
      answers[currentIndex] = { answered:true, user:'Difficile', correct:false };
      playTone('fail'); $('#feedback').textContent = 'On continue.';
      updateScoreArea();
      setTimeout(()=> moveToNextUnanswered(), 700);
    };
  }
}

/* navigation helpers */
function moveToNextUnanswered(){
  // find next index where answers[index] is null or answered===false for phases
  for(let i=currentIndex+1;i<MAX_QUESTIONS;i++){
    const a = answers[i];
    if(!a || (a && a.answered === false)) { currentIndex = i; renderCurrent(); return; }
  }
  // else try from start
  for(let i=0;i<MAX_QUESTIONS;i++){
    const a = answers[i];
    if(!a || (a && a.answered === false)) { currentIndex = i; renderCurrent(); return; }
  }
  // all answered => end
  showEndScreen();
}

function updateScoreArea(){
  const answeredCount = answers.filter(a => a && a.answered).length;
  $('#score-area').textContent = `Score partie : ${sessionScore} / ${answeredCount}`;
}

/* prev / next manual navigation (user requested) */
function goPrev(){
  if(currentIndex > 0){
    currentIndex--;
    renderCurrent();
  }
}
function goNext(){
  if(currentIndex < MAX_QUESTIONS - 1){
    currentIndex++;
    renderCurrent();
  }
}

/* end screen */
function showEndScreen(){
  const body = $('#modal-body');
  body.innerHTML = `<div style="text-align:center;padding:18px">
    <h2 style="color:var(--accent)">Fin de la partie</h2>
    <p style="font-size:1.3rem">Ta note : ${sessionScore} / ${MAX_QUESTIONS}</p>
    <p style="color:var(--muted)">Score global mis à jour.</p>
    <div style="margin-top:12px;display:flex;gap:10px;justify-content:center">
      <button id="btn-close-game" class="btn primary">Retour à l'accueil</button>
      <button id="btn-review" class="btn muted">Revoir les réponses</button>
    </div>
  </div>`;
  $('#btn-close-game').onclick = () => {
    // save global stats and close
    globalStats.totals[currentGame] += sessionScore;
    globalStats.attempts[currentGame] += MAX_QUESTIONS;
    saveGlobalStats();
    updateProgressUI();
    closeGame(false); // we already saved
  };
  $('#btn-review').onclick = () => {
    // show first question in review mode (we keep answers)
    currentIndex = 0;
    renderCurrent();
  };
}

/* Init & event binding */
document.addEventListener('DOMContentLoaded', () => {
  // update progress UI
  updateProgressUI();

  // start buttons
  $$('.start-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.game;
      openGame(id);
    });
  });

  // modal controls
  $('#btn-close').onclick = () => closeGame(true);
  $('#btn-prev').onclick = goPrev;
  $('#btn-next').onclick = goNext;

  // keyboard accessibility
  document.addEventListener('keydown', (e) => {
    const modalOpen = $('#modal').getAttribute('aria-hidden') === 'false';
    if(!modalOpen) return;
    if(e.key === 'ArrowLeft') goPrev();
    if(e.key === 'ArrowRight') goNext();
    if(e.key === 'Escape') closeGame(true);
  });
});
