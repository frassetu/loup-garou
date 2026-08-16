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
  const [copieCode, setCopieCode] = useState(false);
  const [modeDistribution, setModeDistribution] = useState("auto"); // 'auto' | 'manuel'
  const [assignationManuelle, setAssignationManuelle] = useState({});
  const [choixMaireOuvert, setChoixMaireOuvert] = useState(false);
  const [choixAmoureuxA, setChoixAmoureuxA] = useState("");
  const [choixCupidonOuvert, setChoixCupidonOuvert] = useState(false);
  const [enfantOuvertId, setEnfantOuvertId] = useState(null);

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

    // On revérifie la liste de joueurs directement en base juste avant
    // d'envoyer les rôles, pour éviter qu'un joueur ayant rejoint entre
    // le dernier rafraîchissement et le clic ne soit oublié.
    const { data: joueursFrais, error: fetchErr } = await supabase
      .from("joueurs")
      .select("*")
      .eq("partie_id", partie.id)
      .order("created_at", { ascending: true });

    if (fetchErr || !joueursFrais) {
      setErreur("Impossible de récupérer la liste des joueurs, réessayez.");
      setDistribution(false);
      return;
    }

    if (totalRolesChoisis > joueursFrais.length) {
      setErreur(
        `Vous avez sélectionné ${totalRolesChoisis} rôles pour seulement ${joueursFrais.length} joueur(s) réellement inscrit(s). Ajustez et réessayez.`
      );
      setDistribution(false);
      return;
    }

    // Construit la pile de rôles : les rôles choisis + des Villageois
    // pour compléter jusqu'au nombre de joueurs.
    const pileBase = [];
    for (const [roleId, count] of Object.entries(rolesConfig)) {
      for (let i = 0; i < count; i++) pileBase.push(roleId);
    }
    while (pileBase.length < joueursFrais.length) pileBase.push("villageois");

    // On tire plusieurs mélanges et on garde celui qui redonne le moins
    // souvent le même rôle qu'à la manche précédente à un même joueur —
    // ça évite l'impression que "c'est toujours la même personne".
    let meilleurePile = melanger(pileBase);
    let meilleurScore = joueursFrais.filter(
      (j, i) => j.dernier_role && j.dernier_role === meilleurePile[i]
    ).length;

    for (let tentative = 0; tentative < 40 && meilleurScore > 0; tentative++) {
      const essai = melanger(pileBase);
      const score = joueursFrais.filter(
        (j, i) => j.dernier_role && j.dernier_role === essai[i]
      ).length;
      if (score < meilleurScore) {
        meilleurScore = score;
        meilleurePile = essai;
      }
    }

    const resultats = await Promise.all(
      joueursFrais.map((joueur, index) =>
        supabase
          .from("joueurs")
          .update({ role: meilleurePile[index] })
          .eq("id", joueur.id)
          .select()
      )
    );

    const echecs = resultats.filter((r) => r.error || !r.data?.length);
    if (echecs.length > 0) {
      setErreur(
        `${echecs.length} joueur(s) n'ont pas reçu leur rôle correctement (problème réseau). Cliquez à nouveau sur "Distribuer" pour réessayer.`
      );
      setDistribution(false);
      return;
    }

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

    const { data: joueursFrais, error: fetchErr } = await supabase
      .from("joueurs")
      .select("*")
      .eq("partie_id", partie.id)
      .order("created_at", { ascending: true });

    if (fetchErr || !joueursFrais) {
      setErreur("Impossible de récupérer la liste des joueurs, réessayez.");
      setDistribution(false);
      return;
    }

    const resultats = await Promise.all(
      joueursFrais.map((joueur) =>
        supabase
          .from("joueurs")
          .update({ role: assignationManuelle[joueur.id] || "villageois" })
          .eq("id", joueur.id)
          .select()
      )
    );

    const echecs = resultats.filter((r) => r.error || !r.data?.length);
    if (echecs.length > 0) {
      setErreur(
        `${echecs.length} joueur(s) n'ont pas reçu leur rôle correctement (problème réseau). Cliquez à nouveau sur "Distribuer" pour réessayer.`
      );
      setDistribution(false);
      return;
    }

    await supabase
      .from("parties")
      .update({ statut: "distribue" })
      .eq("id", partie.id);

    setDistribution(false);
  }

  function changerAssignation(joueurId, roleId) {
    setAssignationManuelle((prev) => ({ ...prev, [joueurId]: roleId }));
  }

  async function marquerVivantFaux(joueurId) {
    await supabase.from("joueurs").update({ vivant: false }).eq("id", joueurId);
    if (partie?.maire_id === joueurId) {
      await supabase
        .from("parties")
        .update({ maire_id: null })
        .eq("id", partie.id);
    }
  }

  async function eliminerJoueur(joueurId) {
    const joueur = joueurs.find((j) => j.id === joueurId);
    await marquerVivantFaux(joueurId);

    // Cupidon : l'amoureux meurt aussi de chagrin
    if (joueur?.amoureux_id) {
      const amoureux = joueurs.find((j) => j.id === joueur.amoureux_id);
      if (amoureux && amoureux.vivant) {
        const confirmer = window.confirm(
          `${joueur.nom} était amoureux(se) de ${amoureux.nom}.\n\nSelon les règles, ${amoureux.nom} meurt aussi de chagrin.\n\nL'éliminer également ?`
        );
        if (confirmer) {
          await marquerVivantFaux(amoureux.id);
        }
      }
    }

    // Enfant Sauvage : si son modèle vient de mourir, il devient Loup-Garou
    const enfants = joueurs.filter(
      (j) =>
        j.modele_id === joueurId &&
        j.role === "enfant-sauvage" &&
        j.vivant &&
        j.id !== joueurId
    );
    for (const enfant of enfants) {
      const confirmer = window.confirm(
        `${joueur?.nom || "Ce joueur"} était le modèle de l'Enfant Sauvage (${enfant.nom}).\n\nSelon les règles, ${enfant.nom} devient Loup-Garou dès maintenant.\n\nEffectuer la transformation ?`
      );
      if (confirmer) {
        await supabase
          .from("joueurs")
          .update({ role: "loup-garou" })
          .eq("id", enfant.id);
      }
    }
  }

  async function lierAmoureuxAvec(idA, idB) {
    await supabase.from("joueurs").update({ amoureux_id: idB }).eq("id", idA);
    await supabase.from("joueurs").update({ amoureux_id: idA }).eq("id", idB);
    setChoixAmoureuxA("");
    setChoixCupidonOuvert(false);
  }

  function toucherJoueurAmoureux(id) {
    if (choixAmoureuxA === id) {
      setChoixAmoureuxA("");
      return;
    }
    if (!choixAmoureuxA) {
      setChoixAmoureuxA(id);
      return;
    }
    lierAmoureuxAvec(choixAmoureuxA, id);
  }

  async function delierAmoureux() {
    const paire = joueurs.filter((j) => j.amoureux_id);
    await Promise.all(
      paire.map((j) =>
        supabase.from("joueurs").update({ amoureux_id: null }).eq("id", j.id)
      )
    );
  }

  async function designerModele(enfantId, modeleId) {
    await supabase
      .from("joueurs")
      .update({ modele_id: modeleId || null })
      .eq("id", enfantId);
    setEnfantOuvertId(null);
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

    // On garde une trace du rôle de cette manche pour éviter de le
    // redonner directement à la même personne à la prochaine distribution.
    const { data: joueursActuels } = await supabase
      .from("joueurs")
      .select("id, role")
      .eq("partie_id", partie.id);

    await Promise.all(
      (joueursActuels || []).map((j) =>
        supabase
          .from("joueurs")
          .update({
            dernier_role: j.role,
            role: null,
            vivant: true,
            amoureux_id: null,
            modele_id: null,
          })
          .eq("id", j.id)
      )
    );

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

  function copierCode() {
    navigator.clipboard.writeText(code);
    setCopieCode(true);
    setTimeout(() => setCopieCode(false), 1800);
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
  const cupidonPresent = joueurs.some((j) => j.role === "cupidon");
  const enfantsSauvages = joueurs.filter((j) => j.role === "enfant-sauvage");
  const peresIds = enfantsSauvages.map((j) => j.modele_id).filter(Boolean);
  const premierAmoureux = joueurs.find((j) => j.amoureux_id);
  const paireAmoureux = premierAmoureux
    ? [premierAmoureux, joueurs.find((j) => j.id === premierAmoureux.amoureux_id)]
    : null;

  return (
    <main className="page">
      <div className="code-banner">
        <div className="code-value">{code}</div>
        <div className="code-actions">
          <button className="btn-mini" onClick={copierCode}>
            {copieCode ? "Copié ✓" : "Code"}
          </button>
          <button className="btn-mini" onClick={copierLien}>
            {copie ? "Copié ✓" : "Lien"}
          </button>
        </div>
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
                        {role.camp === "loups"
                          ? "Camp des loups"
                          : role.camp === "mixte"
                          ? "Camp au choix"
                          : "Camp du village"}
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
        <div className={maire ? "card card-compact" : "card card-compact alert-card"}>
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
            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn-primary btn-block"
                onClick={tirerMaireAuSort}
                style={{ marginBottom: 10 }}
              >
                Tirer au sort parmi les joueurs vivants
              </button>
              <div className="chip-row">
                {vivants.map((j) => (
                  <button
                    key={j.id}
                    className={
                      partie.maire_id === j.id ? "chip chip-active" : "chip"
                    }
                    onClick={() => designerMaire(j.id)}
                  >
                    {j.nom}
                  </button>
                ))}
              </div>
              {maire && (
                <button
                  className="btn btn-secondary btn-block"
                  style={{ marginTop: 10 }}
                  onClick={retirerMaire}
                >
                  Retirer le titre de maire
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {distribue && cupidonPresent && (
        <div
          className={
            paireAmoureux && paireAmoureux[1]
              ? "card card-compact"
              : "card card-compact alert-card"
          }
        >
          <div className="role-row" style={{ border: "none", padding: 0 }}>
            <div>
              <div className="role-name">Couple d'amoureux</div>
              <div className="role-camp">
                {paireAmoureux && paireAmoureux[1]
                  ? `💘 ${paireAmoureux[0].nom} + ${paireAmoureux[1].nom}`
                  : "Aucun couple désigné"}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setChoixCupidonOuvert((v) => !v)}
            >
              {paireAmoureux ? "Changer" : "Désigner"}
            </button>
          </div>

          {choixCupidonOuvert && (
            <div style={{ marginTop: 14 }}>
              <div className="chip-row">
                {joueurs.map((j) => (
                  <button
                    key={j.id}
                    className={
                      choixAmoureuxA === j.id ? "chip chip-active" : "chip"
                    }
                    onClick={() => toucherJoueurAmoureux(j.id)}
                  >
                    {j.nom}
                  </button>
                ))}
              </div>
              <p className="lede" style={{ fontSize: 12, margin: "8px 0 0" }}>
                {choixAmoureuxA
                  ? "Touchez un second nom pour former le couple."
                  : "Touchez deux noms pour les lier."}
              </p>
              {paireAmoureux && paireAmoureux[1] && (
                <button
                  className="btn btn-secondary btn-block"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    delierAmoureux();
                    setChoixCupidonOuvert(false);
                  }}
                >
                  Retirer le couple
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {distribue && enfantsSauvages.length > 0 && (
        <div className="card card-compact">
          <div className="stack">
            {enfantsSauvages.map((enfant) => {
              const modele = joueurs.find((j) => j.id === enfant.modele_id);
              return (
                <div key={enfant.id}>
                  <div className="role-row" style={{ border: "none", padding: 0 }}>
                    <div>
                      <div className="role-name">Enfant Sauvage</div>
                      <div className="role-camp">
                        {enfant.nom} — Père :{" "}
                        {modele ? modele.nom : "non désigné"}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setEnfantOuvertId((v) =>
                          v === enfant.id ? null : enfant.id
                        )
                      }
                    >
                      {modele ? "Changer" : "Désigner"}
                    </button>
                  </div>
                  {enfantOuvertId === enfant.id && (
                    <div className="chip-row" style={{ marginTop: 10 }}>
                      {joueurs
                        .filter((j) => j.id !== enfant.id)
                        .map((j) => (
                          <button
                            key={j.id}
                            className={
                              enfant.modele_id === j.id
                                ? "chip chip-active"
                                : "chip"
                            }
                            onClick={() => designerModele(enfant.id, j.id)}
                          >
                            {j.nom}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                  {j.amoureux_id && <span title="Amoureux">🏹</span>}
                  {peresIds.includes(j.id) && (
                    <span title="Père désigné">👨🏻</span>
                  )}
                  {j.role === "enfant-sauvage" && (
                    <span title="Enfant Sauvage">👶🏻</span>
                  )}
                  {distribue && j.role && (
                    <span className="role-tag">
                      {ROLES_BY_ID[j.role]?.nom || j.role}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
                    className="btn-remove"
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
                  {j.amoureux_id && <span title="Amoureux">🏹</span>}
                  {peresIds.includes(j.id) && (
                    <span title="Père désigné">👨🏻</span>
                  )}
                  {j.role === "enfant-sauvage" && (
                    <span title="Enfant Sauvage">👶🏻</span>
                  )}
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