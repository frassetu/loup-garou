import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

// Force le rendu dynamique pour que le compteur soit toujours a jour
// (sinon Next.js pourrait figer la page au moment du build).
export const dynamic = "force-dynamic";

export default async function Home() {
  let compteur = null;
  try {
    const { data } = await supabase
      .from("stats")
      .select("parties_jouees")
      .eq("id", 1)
      .maybeSingle();
    compteur = data?.parties_jouees ?? null;
  } catch (e) {
    compteur = null;
  }

  return (
    <main className="page">
      {compteur !== null && (
        <div className="partie-counter">{"#" + compteur}</div>
      )}
      <div className="eyebrow">Loup-Garou</div>
      <h1>{"La nuit tombe sur le village."}</h1>
      <p className="lede">
        {
          "Cr\u00e9ez une partie, choisissez les r\u00f4les, et distribuez-les directement sur le t\u00e9l\u00e9phone de chaque joueur."
        }
      </p>

      <div className="home-choice">
        <Link href="/creer" className="choice-card">
          <div className="choice-title">{"Je suis le narrateur"}</div>
          <div className="choice-sub">
            {"Cr\u00e9er une partie et distribuer les r\u00f4les"}
          </div>
        </Link>

        <Link href="/rejoindre" className="choice-card">
          <div className="choice-title">{"Je suis joueur"}</div>
          <div className="choice-sub">
            {"Rejoindre une partie avec le code du narrateur"}
          </div>
        </Link>
      </div>

      <div className="footer-note">
        {"Aucun compte requis \u00b7 Aucune donn\u00e9e conserv\u00e9e"}
      </div>
    </main>
  );
}