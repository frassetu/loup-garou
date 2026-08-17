// Definition des roles disponibles.
// "camp" sert uniquement a l'affichage (couleur de la carte).
export const ROLES = [
  {
    id: "loup-garou",
    image: "loup-garou.jpg",
    emoji: "\u{1f43a}",
    nom: "Loup-Garou",
    camp: "loups",
    description:
      "Chaque nuit, tu te r\u{e9}veilles avec les autres loups-garous pour d\u{e9}signer une victime \u{e0} d\u{e9}vorer. Le jour, fais-toi passer pour un simple villageois.",
  },
  {
    id: "villageois",
    image: "villageois.webp",
    emoji: "\u{1f464}",
    nom: "Villageois",
    camp: "village",
    description:
      "Tu n'as aucun pouvoir particulier. Ta seule arme : ton discours pour d\u{e9}masquer les loups-garous pendant le d\u{e9}bat du village.",
  },
  {
    id: "voyante",
    image: "voyante.jpg",
    emoji: "\u{1f52e}",
    nom: "Voyante",
    camp: "village",
    description:
      "Chaque nuit, tu peux d\u{e9}couvrir le r\u{f4}le secret d'un joueur de ton choix. Garde cette information pr\u{e9}cieuse... ou r\u{e9}v\u{e8}le-la avec prudence.",
  },
  {
    id: "sorciere",
    image: "sorciere.jpg",
    emoji: "\u{1f9d9}\u{200d}\u{2640}\u{fe0f}",
    nom: "Sorci\u{e8}re",
    camp: "village",
    description:
      "Tu poss\u{e8}des deux potions \u{e0} usage unique : une potion de vie (sauver la victime des loups) et une potion de mort (\u{e9}liminer un joueur de ton choix). Utilise-les avec sagesse.",
  },
  {
    id: "chasseur",
    image: "chasseur.jpg",
    emoji: "\u{1f3af}",
    nom: "Chasseur",
    camp: "village",
    description:
      "Si tu meurs, tu peux imm\u{e9}diatement d\u{e9}signer un autre joueur qui mourra avec toi. Ta mort ne sera jamais silencieuse.",
  },
  {
    id: "cupidon",
    image: "cupidon.jpg",
    emoji: "\u{1f498}",
    nom: "Cupidon",
    camp: "village",
    description:
      "D\u{e8}s le d\u{e9}but de la partie, tu d\u{e9}signes deux joueurs (ou toi-m\u{ea}me) qui tomberont amoureux. Si l'un des deux amoureux meurt, l'autre meurt de chagrin.",
  },
  {
    id: "petite-fille",
    image: "petite-fille.jpg",
    emoji: "\u{1f467}",
    nom: "Petite Fille",
    camp: "village",
    description:
      "Pendant que les loups-garous se r\u{e9}veillent, tu peux discr\u{e8}tement entrouvrir un \u{153}il pour tenter de les rep\u{e9}rer. Attention \u{e0} ne pas te faire surprendre.",
  },
  {
    id: "chien-loup",
    image: "chien-loup.jpg",
    emoji: "\u{1f415}",
    nom: "Chien-Loup",
    camp: "mixte",
    description:
      "Au moment de la r\u{e9}v\u{e9}lation, choisis en secret avec le narrateur si tu rejoins le camp du Village ou celui des Loups-Garous pour le reste de la partie. Ne r\u{e9}v\u{e8}le jamais ton choix aux autres.",
  },
  {
    id: "enfant-sauvage",
    image: "enfant-sauvage.jpg",
    emoji: "\u{1f9d2}",
    nom: "Enfant Sauvage",
    camp: "village",
    description:
      "Au d\u{e9}but de la partie, d\u{e9}signe en secret un joueur comme ton mod\u{e8}le. Si ton mod\u{e8}le meurt en cours de partie, tu deviens un Loup-Garou d\u{e8}s cette nuit-l\u{e0}. Sinon, tu restes un simple villageois.",
  },
  {
    id: "loup-blanc",
    image: "loup-blanc.jpg",
    emoji: "\u{26aa}",
    nom: "Loup Blanc",
    camp: "loups",
    description:
      "Tu te r\u{e9}veilles avec les autres loups-garous mais ils ignorent qui tu es. Une nuit sur deux, tu peux en plus d\u{e9}vorer secr\u{e8}tement un autre loup-garou. Tu ne gagnes pas avec la meute : tu dois \u{ea}tre le dernier survivant, seul contre tous.",
  },
];

export const ROLES_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export const CAMP_LABEL = {
  loups: "Camp des Loups-Garous",
  village: "Camp du Village",
  mixte: "Camp au choix",
};