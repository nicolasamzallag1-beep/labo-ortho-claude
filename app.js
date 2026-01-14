const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let currentGame = null;
let currentIndex = 0;

function normalizeText(str) {
  return (str || '').toLowerCase().trim();
}

function openGame(id) {
  currentGame = Number(id);
  currentIndex = 0;
  $('#modal').setAttribute('aria-hidden', 'false');
  render();
}

function closeGame() {
  $('#modal').setAttribute('aria-hidden', 'true');
  $('#feedback').textContent = '';
}

function render() {
  const body = $('#modal-body');
  body.innerHTML = '';
  $('#feedback').textContent = '';
  const data = gameData[`game${currentGame}`];
  if (!data || data.length === 0) {
    body.textContent = 'Aucune donnée disponible.';
    return;
  }
  const item = data[currentIndex % data.length];

  if (currentGame === 1) {
    body.innerHTML = `
      <p>${item.text.replace('___', '______')}</p>
      <input id="input-answer" placeholder="Ta réponse ici" />
      <button id="btn-validate">Valider</button>
      <button id="btn-skip">Passer</button>
    `;
    $('#btn-validate').onclick = () => {
      const val = normalizeText($('#input-answer').value);
      if (val === normalizeText(item.answer)) {
        $('#feedback').textContent = 'Bravo !';
        currentIndex++;
        setTimeout(render, 1000);
      } else {
        $('#feedback').textContent = 'Essaie encore.';
      }
    };
    $('#btn-skip').onclick = () => {
      currentIndex++;
      render();
    };
  } else if (currentGame === 2) {
    body.innerHTML = `<p>${item.phrase}</p>`;
    item.reformulations.forEach((r, i) => {
      const btn = document.createElement('button');
      btn.textContent = r;
      btn.onclick = () => {
        if (i === 0) {
          $('#feedback').textContent = 'Correct !';
          currentIndex++;
          setTimeout(render, 1000);
        } else {
          $('#feedback').textContent = 'Mauvais choix.';
        }
      };
      body.appendChild(btn);
    });
  } else if (currentGame === 3) {
    body.innerHTML = `
      <p>${item}</p>
      <button id="btn-next">Suivant</button>
    `;
    $('#btn-next').onclick = () => {
      currentIndex++;
      render();
    };
  } else if (currentGame === 4) {
    body.innerHTML = `
      <p>${item}</p>
      <button id="btn-next">Suivant</button>
    `;
    $('#btn-next').onclick = () => {
      currentIndex++;
      render();
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.start-btn').forEach(btn => {
    btn.onclick = () => openGame(btn.dataset.game);
  });
  $('#close-modal').onclick = closeGame;
});
