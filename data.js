// data.js
// Banques de mots, phrases, templates, générateurs avec seed stable

const SEED_BASE = 123456; // seed de base pour stabilité

// Seeded random generator (Mulberry32)
function seededRandom(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Utilitaire shuffle stable
function shuffleArray(array, rand) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Données personnalisées
const playerName = "Claude";
const familyNames = ["Nicolas", "Anita"];
const jewishRefs = [
  "Shabbat",
  "Hanouka",
  "Jérusalem",
  "Tel Aviv",
  "falafel",
  "menorah",
  "kippa",
  "talmud",
  "haggadah",
];

// Épreuve 1 - Texte à trous
const epreuve1Templates = [
  {
    phrase: "Ce matin, {name} a préparé un délicieux {food} pour {family}.",
    blanks: ["food"],
    options: {
      food: ["falafel", "baguette", "croissant", "sushi"],
    },
    explanations: {
      falafel: "Le falafel est un plat traditionnel souvent apprécié dans la culture israélienne.",
      baguette: "La baguette est un pain français, moins lié à la culture mentionnée.",
      croissant: "Le croissant est une pâtisserie française, pas typique ici.",
      sushi: "Le sushi est japonais, hors contexte.",
    },
  },
  {
    phrase: "{name} et {family} vont à {place} pour célébrer {holiday}.",
    blanks: ["place", "holiday"],
    options: {
      place: ["Jérusalem", "Paris", "Londres", "New York"],
      holiday: ["Hanouka", "Noël", "Pâques", "Halloween"],
    },
    explanations: {
      Jérusalem: "Jérusalem est une ville importante dans la culture juive.",
      Paris: "Paris est une grande ville, mais pas liée à la fête mentionnée.",
      Londres: "Londres est une ville, mais pas liée ici.",
      New York: "New York est une ville, mais pas liée ici.",
      Hanouka: "Hanouka est une fête juive célébrée avec joie.",
      Noël: "Noël est une fête chrétienne, différente ici.",
      Pâques: "Pâques est une fête chrétienne.",
      Halloween: "Halloween est une fête populaire mais pas liée ici.",
    },
  },
  {
    phrase: "Le {object} de {name} est posé sur la {place}.",
    blanks: ["object", "place"],
    options: {
      object: ["menorah", "lampe", "livre", "téléphone"],
      place: ["table", "chaise", "étagère", "fenêtre"],
    },
    explanations: {
      menorah: "La menorah est un chandelier traditionnel juif.",
      lampe: "Une lampe éclaire la pièce, mais ce n’est pas l’objet culturel.",
      livre: "Un livre peut être posé, mais ici on parle d’un objet spécial.",
      téléphone: "Un téléphone est courant, mais pas culturel.",
      table: "La table est un meuble commun.",
      chaise: "La chaise est un meuble pour s’asseoir.",
      étagère: "L’étagère sert à ranger des objets.",
      fenêtre: "La fenêtre donne sur l’extérieur.",
    },
  },
  {
    phrase: "{name} aime lire le {book} pendant le {holiday}.",
    blanks: ["book", "holiday"],
    options: {
      book: ["talmud", "roman", "journal", "magazine"],
      holiday: ["Shabbat", "week-end", "vacances", "Hanouka"],
    },
    explanations: {
      talmud: "Le Talmud est un texte sacré du judaïsme.",
      roman: "Un roman est un livre de fiction.",
      journal: "Le journal donne les nouvelles.",
      magazine: "Le magazine traite de divers sujets.",
      Shabbat: "Le Shabbat est un jour de repos sacré.",
      week-end: "Le week-end est un moment de repos général.",
      vacances: "Les vacances sont une période de détente.",
      Hanouka: "Hanouka est une fête joyeuse.",
    },
  },
  {
    phrase: "Anita prépare un plat de {food} pour {name} et {family}.",
    blanks: ["food", "family"],
    options: {
      food: ["falafel", "pâtes", "salade", "soupe"],
      family: ["Nicolas", "Claude", "Anita", "Nicolas et Claude"],
    },
    explanations: {
      falafel: "Le falafel est un plat populaire en Israël.",
      pâtes: "Les pâtes sont un plat italien apprécié.",
      salade: "La salade est un plat léger et sain.",
      soupe: "La soupe est un plat chaud et réconfortant.",
      Nicolas: "Nicolas est le fils de Claude.",
      Claude: "Claude est le joueur principal.",
      Anita: "Anita est la maman.",
      "Nicolas et Claude": "Nicolas et Claude sont la famille proche.",
    },
  },
];

// Épreuve 2 - Reformulation / Synonymes
const epreuve2Synonymes = [
  { word: "heureux", options: ["content", "triste", "fatigué", "fâché"], correct: "content", note: "Content est un synonyme proche d’heureux." },
  { word: "rapide", options: ["lent", "vite", "calme", "fort"], correct: "vite", note: "Vite est un synonyme courant de rapide." },
  { word: "grand", options: ["petit", "énorme", "haut", "large"], correct: "énorme", note: "Énorme est un synonyme de grand." },
  { word: "manger", options: ["boire", "dévorer", "cuisiner", "dormir"], correct: "dévorer", note: "Dévorer est un synonyme fort de manger." },
  { word: "dire", options: ["parler", "écouter", "voir", "entendre"], correct: "parler", note: "Parler est proche de dire." },
  { word: "joli", options: ["beau", "laid", "moche", "sale"], correct: "beau", note: "Beau est un synonyme de joli." },
  { word: "travailler", options: ["jouer", "bosser", "dormir", "manger"], correct: "bosser", note: "Bosser est un synonyme familier de travailler." },
  { word: "content", options: ["heureux", "fâché", "fatigué", "triste"], correct: "heureux", note: "Heureux est un synonyme de content." },
  { word: "marcher", options: ["courir", "avancer", "sauter", "voler"], correct: "avancer", note: "Avancer est proche de marcher." },
  { word: "regarder", options: ["voir", "écouter", "parler", "sentir"], correct: "voir", note: "Voir est un synonyme proche de regarder." },
];

// Reformulations (phrases)
const epreuve2Reformulations = [
  {
    phrase: "Claude aime lire des livres le soir.",
    options: [
      "Le soir, Claude aime lire des livres.",
      "Claude déteste lire des livres le soir.",
      "Claude lit rarement des livres le soir.",
    ],
    correct: 0,
    note: "La première reformulation garde le même sens et style simple.",
  },
  {
    phrase: "Anita prépare un bon repas pour Nicolas.",
    options: [
      "Nicolas prépare un bon repas pour Anita.",
      "Anita cuisine un délicieux repas pour Nicolas.",
      "Anita ne prépare pas de repas.",
    ],
    correct: 1,
    note: "La deuxième reformulation est la meilleure, même sens et style simple.",
  },
  {
    phrase: "Le chat dort sur le canapé.",
    options: [
      "Le chat est réveillé sur le canapé.",
      "Le chat se repose sur le canapé.",
      "Le chien dort sur le canapé.",
    ],
    correct: 1,
    note: "La deuxième reformulation est proche en sens et style.",
  },
  {
    phrase: "Nicolas aime écouter de la musique.",
    options: [
      "Nicolas déteste la musique.",
      "Nicolas apprécie écouter de la musique.",
      "Nicolas joue de la musique.",
    ],
    correct: 1,
    note: "La deuxième reformulation est la meilleure.",
  },
  {
    phrase: "Claude marche dans le parc chaque matin.",
    options: [
      "Chaque matin, Claude se promène dans le parc.",
      "Claude ne va jamais au parc.",
      "Claude court dans le parc chaque matin.",
    ],
    correct: 0,
    note: "La première reformulation garde le sens et style simple.",
  },
];

// Épreuve 3 - Mémoire de phrases
const epreuve3Phrases = [
  "Claude aime les promenades dans le parc.",
  "Anita prépare un gâteau pour Nicolas.",
  "Le soleil brille sur Jérusalem aujourd’hui.",
  "Hanouka est une fête pleine de lumière.",
  "Le falafel est un plat délicieux et croustillant.",
  "Nicolas lit un livre intéressant chaque soir.",
  "La menorah est allumée pendant huit jours.",
  "Claude et Anita chantent ensemble une chanson.",
  "Le talmud contient des enseignements anciens.",
  "Tel Aviv est une ville dynamique et moderne.",
];

// Épreuve 4 - Vitesse & articulation (virelangues)
const epreuve4Virelangues = [
  {
    phrase: "Claude, champion du virelangue, choisit ses chapeaux chauds.",
    question: {
      q: "Que choisit Claude ?",
      options: ["Des chapeaux chauds", "Des chaussures froides", "Des chemises légères", "Des chapeaux froids"],
      correct: 0,
    },
  },
  {
    phrase: "Anita aime les ananas et les avocats au marché.",
    question: {
      q: "Qu’est-ce qu’Anita aime ?",
      options: ["Ananas et avocats", "Pommes et poires", "Bananes et cerises", "Raisins et fraises"],
      correct: 0,
    },
  },
  {
    phrase: "Nicolas nettoie neuf niches noires rapidement.",
    question: {
      q: "Combien de niches nettoie Nicolas ?",
      options: ["Neuf", "Huit", "Dix", "Sept"],
      correct: 0,
    },
  },
  {
    phrase: "Le lapin lit lentement la lettre de Léa.",
    question: {
      q: "Qui lit la lettre ?",
      options: ["Le lapin", "Léa", "Le lion", "Le loup"],
      correct: 0,
    },
  },
  {
    phrase: "Claude cueille cinq coquelicots colorés au coin du chemin.",
    question: {
      q: "Combien de coquelicots cueille Claude ?",
      options: ["Cinq", "Quatre", "Six", "Sept"],
      correct: 0,
    },
  },
];

// Générateur d’items pour chaque épreuve

function generateEpreuve1Items(seed) {
  const rand = seededRandom(seed);
  const items = [];
  const templates = epreuve1Templates;
  for (let i = 0; i < 200; i++) {
    const tpl = templates[i % templates.length];
    // Pour chaque blank, choisir une bonne réponse + 3 distracteurs
    const blanks = tpl.blanks;
    const chosenAnswers = {};
    blanks.forEach((blank) => {
      const opts = tpl.options[blank];
      const correctIndex = Math.floor(rand() * opts.length);
      chosenAnswers[blank] = opts[correctIndex];
    });
    // Construire phrase avec trous
    let phrase = tpl.phrase;
    blanks.forEach((blank) => {
      phrase = phrase.replace(`{${blank}}`, "_____");
    });
    // Pour chaque blank, générer 4 propositions (1 correcte + 3 autres)
    const optionsByBlank = {};
    blanks.forEach((blank) => {
      const opts = tpl.options[blank];
      const correct = chosenAnswers[blank];
      // Distracteurs = autres options sans la bonne
      const distractors = opts.filter((o) => o !== correct);
      const shuffledDistractors = shuffleArray(distractors, rand).slice(0, 3);
      const allOpts = shuffleArray([correct, ...shuffledDistractors], rand);
      optionsByBlank[blank] = {
        correct,
        options: allOpts,
        explanation: tpl.explanations[correct],
      };
    });
    items.push({
      phrase,
      blanks,
      optionsByBlank,
      chosenAnswers,
    });
  }
  return items;
}

function generateEpreuve2Items(seed) {
  const rand = seededRandom(seed);
  const items = [];
  // Mélanger synonymes et reformulations
  const totalSyn = epreuve2Synonymes.length;
  const totalRef = epreuve2Reformulations.length;
  for (let i = 0; i < 200; i++) {
    if (i % 2 === 0) {
      // Synonyme
      const syn = epreuve2Synonymes[i % totalSyn];
      const opts = shuffleArray(syn.options, rand);
      items.push({
        type: "synonyme",
        word: syn.word,
        options: opts,
        correct: syn.correct,
        note: syn.note,
      });
    } else {
      // Reformulation
      const ref = epreuve2Reformulations[i % totalRef];
      const opts = shuffleArray(ref.options, rand);
      const correctIndex = opts.indexOf(ref.options[ref.correct]);
      items.push({
        type: "reformulation",
        phrase: ref.phrase,
        options: opts,
        correct: correctIndex,
        note: ref.note,
      });
    }
  }
  return items;
}

function generateEpreuve3Items(seed) {
  const rand = seededRandom(seed);
  const items = [];
  const phrases = epreuve3Phrases;
  for (let i = 0; i < 200; i++) {
    const phrase = phrases[i % phrases.length];
    // Découper en mots
    const words = phrase.split(" ");
    // Shuffle mots pour affichage désordonné
    const shuffledWords = shuffleArray(words, rand);
    items.push({
      phrase,
      words,
      shuffledWords,
    });
  }
  return items;
}

function generateEpreuve4Items(seed) {
  const rand = seededRandom(seed);
  const items = [];
  const virelangues = epreuve4Virelangues;
  for (let i = 0; i < 200; i++) {
    const item = virelangues[i % virelangues.length];
    items.push(item);
  }
  return items;
}

// Export
const generators = {
  1: generateEpreuve1Items,
  2: generateEpreuve2Items,
  3: generateEpreuve3Items,
  4: generateEpreuve4Items,
};