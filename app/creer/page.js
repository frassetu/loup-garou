"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { genererCode } from "../../lib/utils";

export default function CreerPartie() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  async function creerPartie() {
    setLoading(true);
    setErreur("");
    try {
      // On tente jusqu'à 5 fois en cas de collision de code (très improbable)
      for (let tentative = 0; tentative < 5; tentative++) {
        const code = genererCode();
        const { data, error } = await supabase
          .from("parties")
          .insert({ code, statut: "lobby", roles_config: {} })
          .select()
          .single();

        if (!error && data) {
          router.push(`/narrateur/${code}`);
          return;
        }
        // si erreur de contrainte unique, on boucle et on réessaie
        if (error && error.code !== "23505") {
          throw error;
        }
      }
      throw new Error("Impossible de générer un code unique, réessayez.");
    } catch (e) {
      setErreur(
        e.message?.includes("fetch") || e.message?.includes("Failed")
          ? "Connexion à Supabase impossible. Vérifiez les variables d'environnement."
          : e.message || "Une erreur est survenue."
      );
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <Link href="/" className="back-link">
        ← Retour
      </Link>
      <div className="eyebrow">Narrateur</div>
      <h1>Ouvrir une nouvelle partie</h1>
      <p className="lede">
        Un code de partie sera généré. Partagez-le à vos joueurs pour
        qu'ils rejoignent depuis leur téléphone.
      </p>

      <button
        className="btn btn-primary btn-block"
        onClick={creerPartie}
        disabled={loading}
      >
        {loading ? "Création en cours..." : "Créer la partie"}
      </button>
      {erreur && <p className="error-msg">{erreur}</p>}
    </main>
  );
}
