// Jeu principal — logique légère, sauvegarde locale et navigation
let currentGame = null;
let currentIndex = 0;
let score = 0;

const mainMenu = document.getElementById('main-menu');
const gameZone = document.getElementById('game-zone');
const gameContent = document.getElementById('game-content');
const backButton = document.getElementById('back-button');
const scoreDisplay = document.getElementById('score-display');

const SAVE_KEY = 'labo_ortho_claude_v1';

function init(){
  // cartes
  document.getElementById('game1-card').addEventListener('click', ()=>startGame('game1'));
  document.getElementById('game2-card').addEventListener('click', ()=>startGame('game2'));
  document.getElementById('game3-card').addEventListener('click', ()=>startGame('game3'));
  document.getElementById('game4-card').addEventListener('click', ()=>startGame('game4'));

  backButton.addEventListener('click', backToMenu);

  // acces clavier
  const cards = document.querySelectorAll('.game-card');
  cards.forEach(c => {
    c.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') c.click();
    });
  });

  loadProgress();
  renderScore();
}

function loadProgress(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){
      const obj = JSON.parse(raw);
      score = obj.score || 0;
    } else score = 0;
  }catch(e){
    score = 0;
  }
}

function saveProgress(){
  localStorage.setItem(SAVE_KEY, JSON.stringify({ score }));
}

function renderScore(){
  scoreDisplay.textContent = `Score total : ${score}`;
}

// navigation
function backToMenu(){
  currentGame = null;
  currentIndex = 0;
  gameContent.innerHTML = '';
  mainMenu.classList.remove('hidden');
  gameZone.classList.add('hidden');
  renderScore();
}

function startGame(gameId){
  currentGame = gameId;
  currentIndex = 0;
  mainMenu.classList.add('hidden');
  gameZone.classList.remove('hidden');
  gameContent.innerHTML = '';
  renderScore();
  showQuestion();
}

function showQuestion(){
  const data = gameData[currentGame];
  if(!data || currentIndex >= data.length){
    gameContent.innerHTML = `<p>Bravo ${playerName} — défi terminé !</p>
                             <p>Score pour ce défi : ${score}</p>
                             <button id="end-ok" class="btn btn-success">Retour au menu</button>`;
    document.getElementById('end-ok').addEventListener('click', backToMenu);
    saveProgress();
    return;
  }

  switch(currentGame){
    case 'game1': renderGame1(data[currentIndex]); break;
    case 'game2': renderGame2(data[currentIndex]); break;
    case 'game3': renderGame3(data[currentIndex]); break;
    case 'game4': renderGame4(data[currentIndex]); break;
  }
}

/* --- Game 1: texte à trous --- */
function renderGame1(q){
  gameContent.innerHTML = `
    <p class="question-text">${q.text.replace('___','_____')}</p>
    <input id="g1-input" type="text" aria-label="Réponse" />
    <div style="margin-top:12px">
      <button id="g1-submit" class="btn btn-primary">Valider</button>
    </div>
    <div id="g1-feedback"></div>
  `;
  const input = document.getElementById('g1-input');
  const btn = document.getElementById('g1-submit');
  const fb = document.getElementById('g1-feedback');

  input.focus();
  btn.addEventListener('click', ()=>{
    const val = input.value.trim();
    if(!val) return;
    if(val.toLowerCase() === q.answer.toLowerCase()){
      fb.textContent = 'Bonne réponse 🎉';
      fb.className = 'feedback correct';
      score++;
    } else {
      fb.textContent = `Mauvaise réponse — ${q.answer}`;
      fb.className = 'feedback wrong';
    }
    saveProgress(); renderScore();
    btn.disabled = true; input.disabled = true;
    setTimeout(()=>{ currentIndex++; showQuestion(); }, 1200);
  });
}

/* --- Game 2: reformulation (choix) --- */
function renderGame2(q){
  gameContent.innerHTML = `
    <p class="question-text">Reformule : <em>"${q.phrase}"</em></p>
    <div class="options" id="g2-options"></div>
    <div id="g2-feedback"></div>
  `;
  const options = document.getElementById('g2-options');
  const fb = document.getElementById('g2-feedback');

  // préparer choix : prendre la 1ère reformulation comme "bonne"
  const correct = q.reformulations && q.reformulations[0] ? q.reformulations[0] : q.phrase;
  const fake = q.reformulations && q.reformulations[1] ? q.reformulations[1] : q.phrase + ' (autre)';
  let choices = shuffle([correct, fake]);

  choices.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'btn btn-primary';
    b.style.minWidth = '48%';
    b.textContent = ch;
    b.addEventListener('click', ()=>{
      if(ch === correct){
        fb.textContent = "Bonne reformulation 🎉"; fb.className='feedback correct'; score++;
      } else { fb.textContent = "Ce n'est pas la meilleure reformulation."; fb.className='feedback wrong'; }
      disableOptions(); saveProgress(); renderScore();
      setTimeout(()=>{ currentIndex++; showQuestion(); }, 1200);
    });
    options.appendChild(b);
  });

  function disableOptions(){ options.querySelectorAll('button').forEach(x=>x.disabled=true); }
}

/* --- Game 3: mémoire de phrase --- */
function renderGame3(phrase){
  gameContent.innerHTML = `
    <p class="question-text">Lis et mémorise :</p>
    <blockquote style="font-size:1.15rem; font-style:italic;">"${phrase}"</blockquote>
    <button id="g3-ready" class="btn btn-primary">J'ai mémorisé, je réponds</button>
    <div id="g3-area" class="hidden">
      <textarea id="g3-answer" rows="3" style="width:100%; margin-top:10px"></textarea>
      <div style="margin-top:10px"><button id="g3-submit" class="btn btn-primary">Valider</button></div>
      <div id="g3-feedback"></div>
    </div>
  `;
  document.getElementById('g3-ready').addEventListener('click', ()=>{
    document.getElementById('g3-ready').classList.add('hidden');
    document.getElementById('g3-area').classList.remove('hidden');
    document.getElementById('g3-answer').focus();
  });

  document.getElementById('g3-submit').addEventListener('click', ()=>{
    const user = document.getElementById('g3-answer').value.trim().toLowerCase();
    const correct = phrase.trim().toLowerCase();
    const fb = document.getElementById('g3-feedback');
    if(!user) return;
    if(user === correct){ fb.textContent = 'Exactement — bravo ! 🎉'; fb.className='feedback correct'; score++; }
    else { fb.textContent = `Presque. Phrase attendue : "${phrase}"`; fb.className='feedback wrong'; }
    saveProgress(); renderScore();
    setTimeout(()=>{ currentIndex++; showQuestion(); }, 1500);
  });
}

/* --- Game 4: articulation (lecture) --- */
function renderGame4(phrase){
  gameContent.innerHTML = `
    <p class="question-text">Lis vite cette phrase à voix haute :</p>
    <blockquote style="font-size:1.15rem; font-style:italic;">"${phrase}"</blockquote>
    <div style="margin-top:12px">
      <button id="g4-next" class="btn btn-primary">Phrase suivante (j'ai lu)</button>
    </div>
  `;
  document.getElementById('g4-next').addEventListener('click', ()=>{
    score++; saveProgress(); renderScore();
    currentIndex++; showQuestion();
  });
}

/* utilitaire shuffle */
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

init();
