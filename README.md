# Loup-Garou — distribution de rôles

App pour distribuer les rôles d'une partie de Loup-Garou en direct sur le
téléphone de chaque joueur.

- Le narrateur crée une partie → obtient un code à 5 caractères
- Les joueurs rejoignent via `/joueur/CODE` et entrent leur prénom
- Le narrateur choisit les rôles (nombre de Loups-Garous, Voyante,
  Sorcière, Chasseur, Cupidon, Petite Fille — le reste devient Villageois)
- Un clic sur "Distribuer les rôles" envoie instantanément son rôle à
  chaque joueur, sans recharger la page (Supabase Realtime)
- Le narrateur peut éliminer un joueur au fil de la partie (le joueur voit
  alors "Tu as été éliminé"), le rétablir, ou le retirer complètement
- "Nouvelle manche" remet tout le monde en jeu sans avoir à redonner le lien

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créez un nouveau projet (gratuit)
2. Dans **SQL Editor**, collez et exécutez le contenu de `supabase-schema.sql`
   (crée les tables `parties` et `joueurs`, active le Realtime)
3. Dans **Project Settings > API**, notez :
   - `Project URL` → deviendra `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → deviendra `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Mettre le code sur GitHub

Depuis l'éditeur web GitHub (comme pour vos autres projets) :

1. Créez un nouveau repo, par exemple `loup-garou`
2. Uploadez tous les fichiers de ce dossier en conservant l'arborescence
   (glisser-déposer le dossier entier fonctionne dans l'éditeur web GitHub)
3. Ne touchez pas à `.env.local.example` — c'est juste un modèle, les vraies
   clés se configurent sur Vercel (étape suivante), jamais dans le repo

## 3. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), **Add New Project** → importez le
   repo `loup-garou`
2. Framework détecté automatiquement : Next.js
3. Dans **Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_SUPABASE_URL` = votre Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre clé anon
4. **Deploy**

Votre app est en ligne, par exemple `loup-garou.vercel.app`.

## Utilisation le soir de la partie

1. Le narrateur ouvre `loup-garou.vercel.app` → "Je suis le narrateur" →
   "Créer la partie"
2. Il partage le code (ou le lien complet) aux joueurs, qui ouvrent
   `loup-garou.vercel.app/joueur/CODE` sur leur téléphone et entrent leur nom
3. Une fois tout le monde inscrit, le narrateur ajuste les rôles et clique
   "Distribuer les rôles" — chaque téléphone affiche le rôle instantanément
4. Au fil de la partie, le narrateur clique "Éliminer" sur les joueurs qui
   sortent du jeu

## Notes techniques

- Pas de compte utilisateur : le "secret" d'une partie est simplement son
  code à 5 caractères, non deviné par hasard mais pas chiffré non plus —
  suffisant pour un usage entre amis
- Chaque joueur est identifié par un ID stocké dans le `localStorage` de
  son téléphone, ce qui lui permet de retrouver son rôle s'il recharge la
  page ou perd la connexion un instant
- Row Level Security est activé sur Supabase avec des policies ouvertes
  (lecture/écriture publique) car il n'y a pas d'authentification —
  cohérent avec le fait qu'aucune donnée sensible n'est stockée
