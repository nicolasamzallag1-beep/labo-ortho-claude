// data.js — banques simples de questions

const DATA = {
  names: {
    dad: "Claude",
    mom: "Anita",
    me: "Nicolas"
  },

  fillBlanks: [
    {
      q: "Claude prend son temps, ___ il répond calmement.",
      choices: ["donc", "mais", "hier", "vite"],
      a: 0,
      explain: "« donc » relie logiquement les deux idées."
    },
    {
      q: "Anita prépare le thé ___ la cuisine.",
      choices: ["dans", "sur", "avec", "sans"],
      a: 0,
      explain: "On dit : dans la cuisine."
    }
  ],

  reformulation: [
    {
      q: "Quel mot est le plus proche de « calme » ?",
      choices: ["paisible", "bruyant", "rapide", "cassé"],
      a: 0,
      explain: "« Paisible » garde l’idée de tranquillité."
    }
  ],

  memory: [
    "Claude lit une phrase tranquillement",
    "Anita et Nicolas sourient ensemble"
  ],

  reading: [
    {
      text: "Les chaussettes de l’archiduchesse sont-elles sèches ?",
      q: "De quoi parle la phrase ?",
      choices: ["des chaussettes", "d’un chien", "d’une voiture", "d’un livre"],
      a: 0
    }
  ]
};
