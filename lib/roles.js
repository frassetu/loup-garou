// Définition des rôles disponibles.
// "camp" sert uniquement à l'affichage (couleur de la carte).
export const ROLES = [
  {
    id: "loup-garou",
    nom: "Loup-Garou",
    camp: "loups",
    description:
      "Chaque nuit, tu te réveilles avec les autres loups-garous pour désigner une victime à dévorer. Le jour, fais-toi passer pour un simple villageois.",
  },
  {
    id: "villageois",
    nom: "Villageois",
    camp: "village",
    description:
      "Tu n'as aucun pouvoir particulier. Ta seule arme : ton discours pour démasquer les loups-garous pendant le débat du village.",
  },
  {
    id: "voyante",
    nom: "Voyante",
    camp: "village",
    description:
      "Chaque nuit, tu peux découvrir le rôle secret d'un joueur de ton choix. Garde cette information précieuse... ou révèle-la avec prudence.",
  },
  {
    id: "sorciere",
    nom: "Sorcière",
    camp: "village",
    description:
      "Tu possèdes deux potions à usage unique : une potion de vie (sauver la victime des loups) et une potion de mort (éliminer un joueur de ton choix). Utilise-les avec sagesse.",
  },
  {
    id: "chasseur",
    nom: "Chasseur",
    camp: "village",
    description:
      "Si tu meurs, tu peux immédiatement désigner un autre joueur qui mourra avec toi. Ta mort ne sera jamais silencieuse.",
  },
  {
    id: "cupidon",
    nom: "Cupidon",
    camp: "village",
    description:
      "Dès le début de la partie, tu désignes deux joueurs (ou toi-même) qui tomberont amoureux. Si l'un des deux amoureux meurt, l'autre meurt de chagrin.",
  },
  {
    id: "petite-fille",
    nom: "Petite Fille",
    camp: "village",
    description:
      "Pendant que les loups-garous se réveillent, tu peux discrètement entrouvrir un œil pour tenter de les repérer. Attention à ne pas te faire surprendre.",
  },
  {
    id: "chien-loup",
    nom: "Chien-Loup",
    camp: "mixte",
    description:
      "Au moment de la révélation, choisis en secret avec le narrateur si tu rejoins le camp du Village ou celui des Loups-Garous pour le reste de la partie. Ne révèle jamais ton choix aux autres.",
  },
  {
    id: "enfant-sauvage",
    nom: "Enfant Sauvage",
    camp: "village",
    description:
      "Au début de la partie, désigne en secret un joueur comme ton modèle. Si ton modèle meurt en cours de partie, tu deviens un Loup-Garou dès cette nuit-là. Sinon, tu restes un simple villageois.",
  },
];

export const ROLES_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export const CAMP_LABEL = {
  loups: "Camp des Loups-Garous",
  village: "Camp du Village",
  mixte: "Camp au choix",
};