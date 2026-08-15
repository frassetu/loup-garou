// Génère un code de partie court et facile à dicter à voix haute.
export function genererCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// Identifiant de session stocké en localStorage pour retrouver son rôle
// après un rechargement de page, sans compte utilisateur.
export function getOrCreateSessionId(code) {
  if (typeof window === "undefined") return null;
  const key = `lg_session_${code}`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export function getStoredPlayerId(code) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`lg_joueur_id_${code}`);
}

export function setStoredPlayerId(code, joueurId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`lg_joueur_id_${code}`, joueurId);
}

export function clearStoredPlayer(code) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`lg_joueur_id_${code}`);
  window.localStorage.removeItem(`lg_session_${code}`);
}

// Mélange un tableau (Fisher-Yates) avec une source aléatoire de bonne
// qualité (Web Crypto plutôt que Math.random quand disponible).
function randomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function melanger(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}