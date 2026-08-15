import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <div className="eyebrow">Loup-Garou</div>
      <h1>La nuit tombe sur le village.</h1>
      <p className="lede">
        Créez une partie, choisissez les rôles, et distribuez-les
        directement sur le téléphone de chaque joueur.
      </p>

      <div className="home-choice">
        <Link href="/creer" className="choice-card">
          <div className="choice-title">Je suis le narrateur</div>
          <div className="choice-sub">
            Créer une partie et distribuer les rôles
          </div>
        </Link>

        <Link href="/rejoindre" className="choice-card">
          <div className="choice-title">Je suis joueur</div>
          <div className="choice-sub">
            Rejoindre une partie avec le code du narrateur
          </div>
        </Link>
      </div>

      <div className="footer-note">Aucun compte requis · Aucune donnée conservée</div>
    </main>
  );
}
