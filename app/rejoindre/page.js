"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function RejoindrePartie() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  async function verifierEtRejoindre(e) {
    e.preventDefault();
    const codeNettoye = code.trim().toUpperCase();
    if (!codeNettoye) return;

    setLoading(true);
    setErreur("");

    const { data, error } = await supabase
      .from("parties")
      .select("code")
      .eq("code", codeNettoye)
      .maybeSingle();

    if (error) {
      setErreur("Connexion impossible. Réessayez.");
      setLoading(false);
      return;
    }

    if (!data) {
      setErreur("Aucune partie ne correspond à ce code.");
      setLoading(false);
      return;
    }

    router.push(`/joueur/${codeNettoye}`);
  }

  return (
    <main className="page">
      <Link href="/" className="back-link">
        ← Retour
      </Link>
      <div className="eyebrow">Joueur</div>
      <h1>Rejoindre une partie</h1>
      <p className="lede">
        Entrez le code à 5 caractères donné par votre narrateur.
      </p>

      <form className="stack" onSubmit={verifierEtRejoindre}>
        <input
          type="text"
          className="code-input"
          placeholder="XXXXX"
          maxLength={5}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading || code.trim().length === 0}
        >
          {loading ? "Vérification..." : "Continuer"}
        </button>
        {erreur && <p className="error-msg">{erreur}</p>}
      </form>
    </main>
  );
}
