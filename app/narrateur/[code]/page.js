"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { ROLES, ROLES_BY_ID } from "../../../lib/roles";
import { melanger } from "../../../lib/utils";

export default function Narrateur() {
  const { code } = useParams();
  const [partie, setPartie] = useState(null);
  const [joueurs, setJoueurs] = useState([]);
  const [rolesConfig, setRolesConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [distribution, setDistribution] = useState(false);
  const [erreur, setErreur] = useState("");
  const [copie, setCopie] = useState(false);
  const [modeDistribution, setModeDistribution] = useState("auto"); // 'auto' | 'manuel'
  const [assignationManuelle, setAssignationManuelle] = useState({});
  const [choixMaireOuvert, setChoixMaireOuvert] = useState(false);

  const lienJoueur = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/joueur/${code}`;
  }, [code]);

  const chargerDonnees = useCallback(async () => {
    const { data: partieData, error: partieErr } = await supabase
      .from("parties")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (partieErr || !partieData) {
      setErreur("Partie introuvable.");
      setLoading(false);
      return;
    }

    setPartie(partieData);
    setRolesConfig(partieData.roles_config || {});

    const { data: joueursData } = await supabase
      .from("joueurs")
      .select("*")
      .eq("partie_id", partieData.id)
      .order("created_at", { ascending: true });

    setJoueurs(joueursData || []);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // Abonnement temps réel : joueurs qui rejoignent/partent, statut de la partie
  useEffect(() => {
    if (!partie?.id) return;

    const channel = supabase
      .channel(`narrateur-${partie.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "joueurs",
          filter: `partie_id=eq.${partie.id}`,
        },
        () => {
          chargerDonnees();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${partie.id}`,
        },
        (payload) => {
          setPartie(payload.new);
          setRolesConfig(payload.new.roles_config || {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partie?.id, chargerDonnees]);

  // Quand l'app iPhone revient au premier plan (retour depuis l'écran
  // d'accueil ou changement d'app), la connexion temps réel peut avoir été
  // coupée par iOS. On force un rechargement des données à ce moment-là,
  // et on s'assure que la connexion Realtime est bien active.
  useEffect(() => {
    function surRetourApp() {
      if (document.visibilityState === "visible") {
        chargerDonnees();
        supabase.realtime.connect();
      }
    }
    document.addEventListener("visibilitychange", surRetourApp);
    window.addEventListener("focus", surRetourApp);
    window.addEventListener("pageshow", surRetourApp);
    return () => {
      document.removeEventListener("visibilitychange", surRetourApp);
      window.removeEventListener("focus", surRetourApp);
      window.removeEventListener("pageshow", surRetourApp);
    };
  }, [chargerDonnees]);

  const totalRolesChoisis = Object.values(rolesConfig).reduce(
    (a, b) => a + (b || 0),
    0
  );
  const joueursVivants = joueurs.length;
  const peutDistribuerAuto =
    joueursVivants > 0 && totalRolesChoisis <= joueursVivants;

  async function majRole(roleId, delta) {
    if (partie.statut === "distribue") return;
    const actuel = rolesConfig[roleId] || 0;
    const nouveau = Math.max(0, actuel + delta);
    const nouvelleConfig = { ...rolesConfig, [roleId]: nouveau };
    setRolesConfig(nouvelleConfig);

    await supabase
      .from("parties")
      .update({ roles_config: nouvelleConfig })
      .eq("id", partie.id);
  }

  async function distribuerAuto() {
    setErreur("");
    if (joueursVivants === 0) {
      setErreur("Aucun joueur n'a encore rejoint la partie.");
      return;
    }
    if (totalRolesChoisis > joueursVivants) {
      setErreur(
        `Vous avez sélectionné ${totalRolesChoisis} rôles pour seulement ${joueursVivants} joueurs.`
      );
      return;
    }

    setDistribution(true);

    // Construit la pile de rôles : les rôles choisis + des Villageois
    // pour compléter jusqu'au nombre de joueurs.
    const pile = [];
    for (const [roleId, count] of Object.entries(rolesConfig)) {
      for (let i = 0; i < count; i++) pile.push(roleId);
    }
    while (pile.length < joueursVivants) pile.push("villageois");

    const pileMelangee = melanger(pile);

    const mises_a_jour = joueurs.map((joueur, index) =>
      supabase
        .from("joueurs")
        .update({ role: pileMelangee[index] })
        .eq("id", joueur.id)
    );

    await Promise.all(mises_a_jour);
    await supabase
      .from("parties")
      .update({ statut: "distribue" })
      .eq("id", partie.id);

    setDistribution(false);
  }

  async function distribuerManuel() {
    setErreur("");
    if (joueursVivants === 0) {
      setErreur("Aucun joueur n'a encore rejoint la partie.");
      return;
    }

    setDistribution(true);

    const mises_a_jour = joueurs.map((joueur) =>
      supabase
        .from("joueurs")
        .update({ role: assignationManuelle[joueur.id] || "villageois" })
        .eq("id", joueur.id)
    );

    await Promise.all(mises_a_jour);
    await supabase
      .from("parties")
      .update({ statut: "distribue" })
      .eq("id", partie.id);

    setDistribution(false);
  }

  function changerAssignation(joueurId, roleId) {
    setAssignationManuelle((prev) => ({ ...prev, [joueurId]: roleId }));
  }

  async function eliminerJoueur(joueurId) {
    await supabase
      .from("joueurs")
      .update({ vivant: false })
      .eq("id", joueurId);

    // Si le joueur éliminé était le maire, on retire le titre : le
    // narrateur devra désigner un successeur (bandeau ci-dessous).
    if (partie?.maire_id === joueurId) {
      await supabase
        .from("parties")
        .update({ maire_id: null })
        .eq("id", partie.id);
    }
  }

  async function retablirJoueur(joueurId) {
    await supabase
      .from("joueurs")
      .update({ vivant: true })
      .eq("id", joueurId);
  }

  async function retirerJoueur(joueurId) {
    await supabase.from("joueurs").delete().eq("id", joueurId);
  }

  async function designerMaire(joueurId) {
    await supabase
      .from("parties")
      .update({ maire_id: joueurId })
      .eq("id", partie.id);
    setChoixMaireOuvert(false);
  }

  async function tirerMaireAuSort() {
    const vivants = joueurs.filter((j) => j.vivant);
    if (vivants.length === 0) return;
    const elu = vivants[Math.floor(Math.random() * vivants.length)];
    await designerMaire(elu.id);
  }

  async function retirerMaire() {
    await supabase
      .from("parties")
      .update({ maire_id: null })
      .eq("id", partie.id);
    setChoixMaireOuvert(false);
  }

  async function nouvellePartie() {
    if (
      !window.confirm(
        "Remettre tous les joueurs en jeu pour une nouvelle manche ? Les rôles et le maire seront effacés."
      )
    )
      return;

    await supabase
      .from("joueurs")
      .update({ role: null, vivant: true })
      .eq("partie_id", partie.id);

    await supabase
      .from("parties")
      .update({ statut: "lobby", maire_id: null })
      .eq("id", partie.id);

    setAssignationManuelle({});
  }

  function copierLien() {
    navigator.clipboard.writeText(lienJoueur);
    setCopie(true);
    setTimeout(() => setCopie(false), 1800);
  }

  if (loading) {
    return (
      <main className="page">
        <p className="lede">Chargement...</p>
      </main>
    );
  }

  if (erreur && !partie) {
    return (
      <main className="page">
        <Link href="/" className="back-link">
          ← Retour
        </Link>
        <h1>Partie introuvable</h1>
        <p className="lede">{erreur}</p>
      </main>
    );
  }

  const distribue = partie.statut === "distribue";
  const vivants = joueurs.filter((j) => j.vivant);
  const morts = joueurs.filter((j) => !j.vivant);
  const maire = joueurs.find((j) => j.id === partie.maire_id);

  return (
    <main className="page">
      <div className="eyebrow">Tableau du narrateur</div>
      <h1>Partie {code}</h1>

      <div className="code-banner">
        <div>
          <div className="code-value">{code}</div>
          <div className="code-hint">Lien joueur : {lienJoueur}</div>
        </div>
        <button className="btn btn-secondary" onClick={copierLien}>
          {copie ? "Copié ✓" : "Copier"}
        </button>
      </div>

      {!distribue && (
        <div className="card">
          <h2>Distribution des rôles</h2>
          <div className="mode-switch">
            <button
              className={modeDistribution === "auto" ? "mode-btn active" : "mode-btn"}
              onClick={() => setModeDistribution("auto")}
            >
              Aléatoire
            </button>
            <button
              className={modeDistribution === "manuel" ? "mode-btn active" : "mode-btn"}
              onClick={() => setModeDistribution("manuel")}
            >
              Manuelle
            </button>
          </div>

          {modeDistribution === "auto" ? (
            <>
              <div className="stack" style={{ marginTop: 16 }}>
                {ROLES.filter((r) => r.id !== "villageois").map((role) => (
                  <div className="role-row" key={role.id}>
                    <div>
                      <div className="role-name">{role.nom}</div>
                      <div className="role-camp">
                        {role.camp === "loups" ? "Camp des loups" : "Camp du village"}
                      </div>
                    </div>
                    <div className="stepper">
                      <button
                        onClick={() => majRole(role.id, -1)}
                        disabled={(rolesConfig[role.id] || 0) === 0}
                      >
                        −
                      </button>
                      <span className="count">{rolesConfig[role.id] || 0}</span>
                      <button onClick={() => majRole(role.id, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="lede" style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
                Les joueurs sans rôle spécial recevront automatiquement le rôle
                Villageois. {totalRolesChoisis} rôle(s) choisi(s) pour{" "}
                {joueursVivants} joueur(s) inscrit(s).
              </p>
            </>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {joueurs.length === 0 && (
                <p className="lede" style={{ margin: 0 }}>
                  En attente de joueurs avant de pouvoir leur attribuer un rôle.
                </p>
              )}
              {joueurs.map((j) => (
                <div className="role-row" key={j.id}>
                  <div className="role-name">{j.nom}</div>
                  <select
                    className="role-select"
                    value={assignationManuelle[j.id] || "villageois"}
                    onChange={(e) => changerAssignation(j.id, e.target.value)}
                  >
                    {ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nom}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {distribue && (
        <div className={maire ? "card" : "card alert-card"}>
          <div className="role-row" style={{ border: "none", padding: 0 }}>
            <div>
              <div className="role-name">Maire du village</div>
              <div className="role-camp">
                {maire ? `👑 ${maire.nom}` : "Aucun maire désigné"}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setChoixMaireOuvert((v) => !v)}
            >
              {maire ? "Changer" : "Désigner"}
            </button>
          </div>

          {choixMaireOuvert && (
            <div className="stack" style={{ marginTop: 14 }}>
              <button className="btn btn-primary btn-block" onClick={tirerMaireAuSort}>
                Tirer au sort parmi les joueurs vivants
              </button>
              <div className="player-list" style={{ marginTop: 4 }}>
                {vivants.map((j) => (
                  <div className="player-row" key={j.id}>
                    <div className="player-name">
                      <span className="dot" />
                      {j.nom}
                    </div>
                    <button className="btn-danger" onClick={() => designerMaire(j.id)}>
                      Choisir
                    </button>
                  </div>
                ))}
              </div>
              {maire && (
                <button className="btn btn-secondary btn-block" onClick={retirerMaire}>
                  Retirer le titre de maire
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="summary-bar">
          <span>Joueurs inscrits</span>
          <span>{joueurs.length}</span>
        </div>

        {joueurs.length === 0 ? (
          <div className="empty-state">
            En attente de joueurs... partagez le code {code}.
          </div>
        ) : (
          <div className="player-list">
            {vivants.map((j) => (
              <div className="player-row" key={j.id}>
                <div className="player-name">
                  <span className="dot" />
                  {j.nom}
                  {partie.maire_id === j.id && <span title="Maire">👑</span>}
                  {distribue && j.role && (
                    <span className="role-tag">
                      {ROLES_BY_ID[j.role]?.nom || j.role}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {distribue && (
                    <button
                      className="btn-danger"
                      onClick={() => eliminerJoueur(j.id)}
                      title={
                        partie.maire_id === j.id
                          ? "Ce joueur est maire : il perdra ce titre"
                          : undefined
                      }
                    >
                      Éliminer
                    </button>
                  )}
                  <button
                    className="btn-danger"
                    onClick={() => retirerJoueur(j.id)}
                    title="Retirer complètement ce joueur"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {morts.map((j) => (
              <div className="player-row eliminated" key={j.id}>
                <div className="player-name">
                  {j.nom}
                  {j.role && (
                    <span className="role-tag">
                      {ROLES_BY_ID[j.role]?.nom || j.role} · éliminé
                    </span>
                  )}
                </div>
                <button
                  className="btn-danger"
                  onClick={() => retablirJoueur(j.id)}
                >
                  Rétablir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!distribue ? (
        <button
          className="btn btn-primary btn-block"
          onClick={modeDistribution === "auto" ? distribuerAuto : distribuerManuel}
          disabled={
            distribution ||
            joueursVivants === 0 ||
            (modeDistribution === "auto" && !peutDistribuerAuto)
          }
        >
          {distribution ? "Distribution..." : "Distribuer les rôles"}
        </button>
      ) : (
        <button className="btn btn-secondary btn-block" onClick={nouvellePartie}>
          Nouvelle manche (mêmes joueurs)
        </button>
      )}
      {erreur && <p className="error-msg">{erreur}</p>}
    </main>
  );
}