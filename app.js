const app = document.getElementById("app");

function renderMenu() {
  app.innerHTML = `
    <div class="card">
      <h2>Bienvenue Claude 👋</h2>
      <p>Choisis un exercice :</p>

      <button onclick="startFill()">✏️ Texte à trous</button>
      <button onclick="startReform()">🔄 Reformulation</button>
      <button onclick="startMemory()">🧠 Mémoire</button>
      <button onclick="startReading()">📖 Lecture</button>
    </div>
  `;
}

function startFill() {
  const q = DATA.fillBlanks[0];
  app.innerHTML = renderQuestion(q, renderMenu);
}

function startReform() {
  const q = DATA.reformulation[0];
  app.innerHTML = renderQuestion(q, renderMenu);
}

function startMemory() {
  const phrase = DATA.memory[0];
  app.innerHTML = `
    <div class="card">
      <h3>Mémorise la phrase :</h3>
      <p><strong>${phrase}</strong></p>
      <button onclick="renderMenu()">Retour menu</button>
    </div>
  `;
}

function startReading() {
  const q = DATA.reading[0];
  app.innerHTML = `
    <div class="card">
      <p><strong>${q.text}</strong></p>
      <p>${q.q}</p>
      ${q.choices.map((c, i) =>
        `<button class="choice" onclick="check(${i}, ${q.a})">${c}</button>`
      ).join("")}
      <br />
      <button onclick="renderMenu()">Retour menu</button>
    </div>
  `;
}

function renderQuestion(q, backFn) {
  return `
    <div class="card">
      <p><strong>${q.q}</strong></p>
      ${q.choices.map((c, i) =>
        `<button class="choice" onclick="check(${i}, ${q.a})">${c}</button>`
      ).join("")}
      <br />
      <button onclick="renderMenu()">Retour menu</button>
    </div>
  `;
}

function check(i, a) {
  alert(i === a ? "✅ Bien joué !" : "❌ Pas grave, on continue.");
}

renderMenu();
