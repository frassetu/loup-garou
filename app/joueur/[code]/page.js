"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { ROLES_BY_ID, CAMP_LABEL } from "../../../lib/roles";
import {
  getOrCreateSessionId,
  getStoredPlayerId,
  setStoredPlayerId,
  clearStoredPlayer,
} from "../../../lib/utils";

export default function Joueur() {
  const { code } = useParams();
  const [partie, setPartie] = useState(null);
  const [joueur, setJoueur] = useState(null);
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(true);
  const [rejoint, setRejoint] = useState(false);
  const [erreur, setErreur] = useState("");

  const chargerPartie = useCallback(async () => {
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error || !data) {
      setErreur("Cette partie n'existe pas ou plus.");
      setLoading(false);
      return null;
    }
    setPartie(data);
    return data;
  }, [code]);

  useEffect(() => {
    (async () => {
      const partieData = await chargerPartie();
      if (!partieData) return;

      const joueurId = getStoredPlayerId(code);
      if (joueurId) {
        const { data } = await supabase
          .from("joueurs")
          .select("*")
          .eq("id", joueurId)
          .maybeSingle();
        if (data) {
          setJoueur(data);
          setRejoint(true);
        } else {
          clearStoredPlayer(code);
        }
      }
      setLoading(false);
    })();
  }, [code, chargerPartie]);

  // Abonnement temps réel à sa propre ligne joueur + au statut de la partie
  useEffect(() => {
    if (!joueur?.id || !partie?.id) return;

    const channel = supabase
      .channel(`joueur-${joueur.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "joueurs",
          filter: `id=eq.${joueur.id}`,
        },
        (payload) => setJoueur(payload.new)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "joueurs",
          filter: `id=eq.${joueur.id}`,
        },
        () => {
          clearStoredPlayer(code);
          setJoueur(null);
          setRejoint(false);
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
        (payload) => setPartie(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [joueur?.id, partie?.id, code]);

  // Si iOS a mis l'app en pause (retour à l'écran d'accueil, changement
  // d'app) pendant que le narrateur distribuait les rôles, la connexion
  // temps réel peut avoir raté l'événement. On revérifie au retour.
  useEffect(() => {
    async function surRetourApp() {
      if (document.visibilityState !== "visible") return;
      supabase.realtime.connect();

      const { data: partieFraiche } = await supabase
        .from("parties")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (partieFraiche) setPartie(partieFraiche);

      if (joueur?.id) {
        const { data: joueurFrais } = await supabase
          .from("joueurs")
          .select("*")
          .eq("id", joueur.id)
          .maybeSingle();
        if (joueurFrais) {
          setJoueur(joueurFrais);
        } else {
          clearStoredPlayer(code);
          setJoueur(null);
          setRejoint(false);
        }
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
  }, [code, joueur?.id]);

  async function rejoindrePartie(e) {
    e.preventDefault();
    const nomNettoye = nom.trim();
    if (!nomNettoye || !partie) return;

    setErreur("");
    const sessionId = getOrCreateSessionId(code);

    const { data, error } = await supabase
      .from("joueurs")
      .insert({
        partie_id: partie.id,
        session_id: sessionId,
        nom: nomNettoye,
      })
      .select()
      .single();

    if (error) {
      setErreur("Impossible de rejoindre la partie. Réessayez.");
      return;
    }

    setStoredPlayerId(code, data.id);
    setJoueur(data);
    setRejoint(true);
  }

  async function changerDeJoueur() {
    if (joueur?.id) {
      await supabase.from("joueurs").delete().eq("id", joueur.id);
    }
    clearStoredPlayer(code);
    setJoueur(null);
    setRejoint(false);
    setNom("");
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
          ← Accueil
        </Link>
        <h1>Introuvable</h1>
        <p className="lede">{erreur}</p>
      </main>
    );
  }

  // Écran de saisie du nom
  if (!rejoint) {
    return (
      <main className="page">
        <div className="eyebrow">Partie {code}</div>
        <h1>Quel est ton nom ?</h1>
        <p className="lede">
          Il sera visible par le narrateur et les autres joueurs.
        </p>
        <form className="stack" onSubmit={rejoindrePartie}>
          <input
            type="text"
            placeholder="Ton prénom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={10}
            autoFocus
          />
          <p
            className="lede"
            style={{ margin: "-4px 0 0", fontSize: 12, textAlign: "right" }}
          >
            {nom.length}/10
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={!nom.trim()}
          >
            Rejoindre la partie
          </button>
          {erreur && <p className="error-msg">{erreur}</p>}
        </form>
      </main>
    );
  }

  // Joueur éliminé
  if (joueur && joueur.vivant === false) {
    return (
      <main className="page">
        <div className="eliminated-screen">
          <div className="role-title">Tu as été éliminé</div>
          <p className="lede">
            Ton rôle était : {ROLES_BY_ID[joueur.role]?.nom || "inconnu"}.
            <br />
            Reste discret et suis la suite de la partie.
          </p>
        </div>
      </main>
    );
  }

  // En attente de la distribution
  if (!joueur?.role) {
    return (
      <main className="page">
        <div className="eyebrow">Partie {code}</div>
        <h1>C'est bon, {joueur?.nom} !</h1>
        <p className="lede">
          Tu es dans la partie. Le narrateur va bientôt distribuer les
          rôles — garde cette page ouverte.
        </p>
        <div className="waiting-pulse">
          <span />
          <span />
          <span />
        </div>
        <button
          className="btn btn-secondary btn-block"
          style={{ marginTop: 32 }}
          onClick={changerDeJoueur}
        >
          Ce n'est pas moi / changer de joueur
        </button>
      </main>
    );
  }

  // Rôle révélé
  const role = ROLES_BY_ID[joueur.role];
  const campClass =
    role?.camp === "loups"
      ? "camp-loups"
      : role?.camp === "mixte"
      ? "camp-mixte"
      : "camp-village";
  const estMaire = partie?.maire_id === joueur.id;

  return (
    <main className="page">
      <div className="eyebrow">Partie {code}</div>
      <div className={`role-reveal ${campClass}`}>
        <div className="camp-label">{CAMP_LABEL[role?.camp] || ""}</div>
        <div className="role-title">{role?.nom || joueur.role}</div>
        <p className="role-desc">{role?.description}</p>
        {estMaire && (
          <div className="maire-badge">
            👑 Tu es aussi le Maire du village — ton vote compte double en
            cas d'égalité.
          </div>
        )}
      </div>
      <button
        className="btn btn-secondary btn-block"
        style={{ marginTop: 20 }}
        onClick={changerDeJoueur}
      >
        Ce n'est pas moi / changer de joueur
      </button>
    </main>
  );
}