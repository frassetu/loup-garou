import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

// IMPORTANT : sans ces deux lignes, Next.js peut garder en cache le resultat
// des requetes Supabase, et le ping n'atteint alors jamais vraiment la base.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Appelee regulierement (cron Vercel + service externe, voir README).
// Supabase met en pause les projets gratuits qui recoivent trop peu de
// requetes sur 7 jours : une seule requete par jour ne suffit pas toujours.
// On envoie donc plusieurs lectures differentes a chaque appel.
export async function GET() {
  try {
    const requetes = [
      supabase.from("parties").select("id").limit(1),
      supabase.from("joueurs").select("id").limit(1),
      supabase.from("stats").select("parties_jouees").eq("id", 1).maybeSingle(),
      supabase.from("parties").select("id", { count: "exact" }).limit(1),
      supabase.from("joueurs").select("id", { count: "exact" }).limit(1),
      supabase
        .from("parties")
        .select("code")
        .order("created_at", { ascending: false })
        .limit(3),
    ];

    const resultats = await Promise.all(requetes);
    const echec = resultats.find((r) => r.error);
    if (echec) throw echec.error;

    return NextResponse.json({
      ok: true,
      requetes: resultats.length,
      time: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e && e.message ? e.message : e) },
      { status: 500 }
    );
  }
}