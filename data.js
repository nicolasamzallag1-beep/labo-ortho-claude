/* data.js
   Banques + générateurs (200 items / épreuve) avec seed stable.
   Pas de dépendances externes.
*/

(() => {
  // -------- Seeded random (stable) --------
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRandom(seedStr){
    const seedFn = xmur3(seedStr);
    return mulberry32(seedFn());
  }

  function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(rng, arr){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // -------- Content banks (FR, léger, pro) --------
  const names = { claude: "Claude", nicolas: "Nicolas", anita: "Anita" };

  const culture = {
    foods: ["falafel", "houmous", "chakchouka", "pita", "salade israélienne"],
    places: ["Jérusalem", "Tel Aviv", "Haïfa"],
    moments: ["Shabbat", "Hanouka", "Pourim"],
    words: ["shalom", "todah", "boker tov"]
  };

  const connectors = ["donc", "car", "mais", "pourtant", "ainsi", "alors", "ensuite"];
  const preps = ["à", "de", "avec", "sans", "pour", "dans", "sur"];
  const verbs = ["prépare", "regarde", "écoute", "range", "choisit", "dépose", "prend", "ouvre", "ferme"];
  const verbs2 = ["répond", "avance", "respire", "sourit", "explique", "continue", "essaie", "réussit"];
  const nouns = ["le livre", "la tasse", "le journal", "la clé", "le téléphone", "la musique", "le carnet", "la photo"];
  const adjectives = ["calme", "clair", "simple", "utile", "agréable", "rapide", "précis", "sympa"];
  const times = ["ce matin", "cet après-midi", "ce soir", "dimanche", "hier", "aujourd’hui"];
  const places = ["à la maison", "dans la cuisine", "au salon", "dans le jardin", "près de la fenêtre"];

  // Cloze templates (texte à trous) : 4 options, 1 bonne + mini explication
  function genCloze(rng, diff){
    // diff: easy/medium/plus -> on joue sur subtilité
    const personalized = rng() < 0.25;
    const cultural = rng() < 0.18;

    let sentence = "";
    let answer = "";
    let options = [];
    let explain = "";

    if (diff === "easy") {
      // connecteurs logiques simples
      const a = pick(rng, connectors);
      const wrong = shuffle(rng, connectors.filter(x => x !== a)).slice(0,3);
      options = shuffle(rng, [a, ...wrong]);

      const subj = personalized ? names.claude : "Il";
      const v = pick(rng, verbs2);
      const adv = pick(rng, ["tranquillement", "avec soin", "avec attention", "sans se presser"]);
      sentence = `${subj} prend son temps, ___ ${subj.toLowerCase() === "il" ? "il" : "il"} ${v} ${adv}.`;
      answer = a;
      explain = `“${a}” relie deux idées : il explique la logique entre les deux parties de la phrase.`;
    } else if (diff === "medium") {
      // prépositions usuelles
      const prep = pick(rng, preps);
      const wrong = shuffle(rng, preps.filter(x => x !== prep)).slice(0,3);
      options = shuffle(rng, [prep, ...wrong]);

      const n = pick(rng, nouns);
      const pl = pick(rng, places);
      sentence = `${personalized ? names.nicolas : "On"} pose ${n} ___ la table ${pl}.`;
      answer = prep;
      explain = `La préposition “${prep}” indique le bon lien entre l’action et le lieu.`;
    } else {
      // accord / déterminant simple
      const detOK = pick(rng, ["un", "le", "ce"]);
      const wrong = shuffle(rng, ["une", "la", "cette", "des", "du"].filter(x => x !== detOK)).slice(0,3);
      options = shuffle(rng, [detOK, ...wrong]);

      const adj = pick(rng, adjectives);
      const n = pick(rng, ["moment", "exercice", "petit défi", "jeu"]);
      sentence = `C’est ___ ${n} ${adj} pour ${personalized ? names.claude : "toi"}.`;
      answer = detOK;
      explain = `“${detOK}” s’accorde correctement avec “${n}”.`;
    }

    if (cultural) {
      // petite touche neutre
      const food = pick(rng, culture.foods);
      sentence = sentence.replace(".", `, comme un ${food} bien préparé.`); // sympa, neutre
      explain += ` Petit clin d’œil : on avance étape par étape, comme une bonne recette.`;
    }

    return {
      type: "cloze",
      text: sentence,
      blank: "___",
      options,
      answerIndex: options.indexOf(answer),
      explain,
      image: "assets/family1.jpeg"
    };
  }

  // Synonymes / reformulation
  const synPairs = [
    ["rapide", ["vite", "prompt", "accéléré"]],
    ["calme", ["paisible", "tranquille", "posé"]],
    ["content", ["heureux", "joyeux", "ravi"]],
    ["fatigué", ["lassé", "épuisé", "crevé"]],
    ["simple", ["facile", "clair", "sans complication"]],
    ["commencer", ["débuter", "entamer", "se lancer"]],
    ["regarder", ["observer", "viser", "examiner"]],
    ["répondre", ["répliquer", "dire", "réagir"]],
  ];

  function genSyn(rng, diff){
    const mode = rng() < 0.55 ? "syn" : "reform";
    const personalized = rng() < 0.22;
    const cultural = rng() < 0.15;

    if (mode === "syn") {
      const [base, list] = pick(rng, synPairs);
      const good = pick(rng, list);
      let distractors = [];
      if (diff === "easy") {
        distractors = shuffle(rng, ["lentement", "bruyant", "loin", "bizarre", "sec"].filter(x => x !== good)).slice(0,3);
      } else if (diff === "medium") {
        distractors = shuffle(rng, ["pressé", "mou", "parfois", "rarement", "léger"].filter(x => x !== good)).slice(0,3);
      } else {
        distractors = shuffle(rng, ["hâtif", "constant", "dense", "prudent", "flou"].filter(x => x !== good)).slice(0,3);
      }
      const options = shuffle(rng, [good, ...distractors]);

      const who = personalized ? names.claude : "On";
      let text = `Choisis le synonyme le plus proche de “${base}”.`;
      let note = `“${good}” a un sens très proche de “${base}”.`;

      if (cultural) {
        const w = pick(rng, culture.words);
        text = `${who} dit “${w}”. ${text}`;
        note += ` Petit mot du jour : “${w}” est un salut chaleureux.`;
      }

      return {
        type: "syn",
        text,
        options,
        answerIndex: options.indexOf(good),
        explain: note,
        image: "assets/family2.jpeg"
      };
    }

    // Reformulation : 1 phrase + 3 reformulations dont 1 équivalente
    const subj = personalized ? names.nicolas : "Quelqu’un";
    const v = pick(rng, verbs2);
    const adv = pick(rng, ["avec attention", "tranquillement", "sans se presser"]);
    const base = `${subj} ${v} ${adv}.`;

    const good = diff === "plus"
      ? `${subj} continue calmement, avec attention.`
      : `${subj} ${v} calmement.`;

    const bad1 = `${subj} s’arrête et oublie tout.`;
    const bad2 = `${subj} fait l’inverse sans réfléchir.`;
    const bad3 = `${subj} ${v} très vite et sans attention.`;

    const options = shuffle(rng, [good, bad1, bad2, bad3]);

    return {
      type: "reform",
      text: `Choisis la reformulation qui garde le même sens :\n“${base}”`,
      options,
      answerIndex: options.indexOf(good),
      explain: `La meilleure reformulation garde l’idée principale (action + manière), sans changer le sens.`,
      image: "assets/family2.jpeg"
    };
  }

  // Mémoire : phrase affichée 6–10s puis reconstruire en cliquant les mots dans l’ordre
  const memStarters = [
    "Ce matin,",
    "Aujourd’hui,",
    "Avec le sourire,",
    "Tranquillement,",
    "Sans se presser,"
  ];
  const memTemplates = [
    (rng) => `${pick(rng, memStarters)} ${names.claude} regarde ${pick(rng, nouns)} ${pick(rng, places)}.`,
    (rng) => `${pick(rng, memStarters)} ${names.anita} prépare ${pick(rng, ["un thé", "un café", "un goûter", "un petit repas"])} pour ${names.claude}.`,
    (rng) => `${pick(rng, memStarters)} ${names.nicolas} envoie une photo et ${names.claude} sourit.`,
    (rng) => `${pick(rng, memStarters)} on avance pas à pas, et c’est très bien comme ça.`,
  ];

  function genMemory(rng, diff){
    const base = pick(rng, memTemplates)(rng);

    let seconds = 8;
    if (diff === "easy") seconds = 10;
    if (diff === "medium") seconds = 8;
    if (diff === "plus") seconds = 6;

    // Petite touche culturelle neutre parfois
    let phrase = base;
    if (rng() < 0.18) {
      const moment = pick(rng, culture.moments);
      phrase = `${base} ${moment} est un bon moment pour se poser.`;
    }

    const clean = phrase
      .replace(/[“”"]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Mots : on conserve ponctuation simple en fin de mot
    const words = clean.split(" ");

    return {
      type: "memory",
      text: clean,
      words,
      seconds,
      image: "assets/family3.jpeg"
    };
  }

  // Articulation : virelangue + auto-éval + petite question d’attention
  const tongueTwisters = [
    "Les chaussettes de l’archiduchesse sont-elles sèches, archi-sèches ?",
    "Un chasseur sachant chasser doit savoir chasser sans son chien.",
    "Je veux et j’exige d’exquises excuses.",
    "Cinq chiens chassent six chats.",
    "Si ces six scies scient ces six cyprès, ces six scies scient aussi ces six pins."
  ];
  const simpleComprehension = [
    { q: "De quoi parle la phrase ?", a: "chaussettes", opts: ["chaussures","chaussettes","voitures","bananes"] },
    { q: "Combien de chiens ?", a: "cinq", opts: ["cinq","deux","neuf","un"] },
    { q: "Que doit savoir faire le chasseur ?", a: "chasser", opts: ["dormir","cuisiner","chasser","chanter"] },
  ];

  function genSpeech(rng, diff){
    const tw = pick(rng, tongueTwisters);
    const comp = pick(rng, simpleComprehension);

    // Variation douce selon difficulté : phrase additionnelle courte
    let extra = "";
    if (diff === "plus" && rng() < 0.6) {
      extra = ` Puis lis aussi : “${pick(rng, ["Claude lit clairement.", "On articule doucement.", "On respire et on recommence."])}”`;
    }

    return {
      type: "speech",
      text: tw + extra,
      compQ: comp.q,
      options: comp.opts,
      answerIndex: comp.opts.indexOf(comp.a),
      image: "assets/family4.jpeg"
    };
  }

  // -------- Public API --------
  const GAMES = {
    cloze: {
      id: "cloze",
      name: "Texte à trous",
      desc: "Complète une phrase avec le bon mot. QCM 4 choix + explication.",
      make200(seed, diff){
        const rng = seededRandom(seed);
        const items = [];
        for (let i=0;i<200;i++) items.push(genCloze(rng, diff));
        return items;
      }
    },
    syn: {
      id: "syn",
      name: "Reformulation / Synonymes",
      desc: "Choisis la meilleure reformulation ou le synonyme le plus proche.",
      make200(seed, diff){
        const rng = seededRandom(seed);
        const items = [];
        for (let i=0;i<200;i++) items.push(genSyn(rng, diff));
        return items;
      }
    },
    memory: {
      id: "memory",
      name: "Mémoire de phrases",
      desc: "Lis une phrase 6–10 secondes puis clique les mots dans le bon ordre.",
      make200(seed, diff){
        const rng = seededRandom(seed);
        const items = [];
        for (let i=0;i<200;i++) items.push(genMemory(rng, diff));
        return items;
      }
    },
    speech: {
      id: "speech",
      name: "Vitesse & articulation",
      desc: "Virelangue + chrono doux + auto-évaluation + question d’attention.",
      make200(seed, diff){
        const rng = seededRandom(seed);
        const items = [];
        for (let i=0;i<200;i++) items.push(genSpeech(rng, diff));
        return items;
      }
    }
  };

  window.LABO = {
    GAMES,
    seededRandom,
    shuffle
  };
})();
