import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

// IMPORTANT : sans ces deux lignes, Next.js peut garder en cache le resultat
// de la requete Supabase, et le ping n'atteint alors jamais vraiment la base.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Appelee une fois par jour par le cron Vercel (voir vercel.json).
// Fait une requete minime a Supabase pour que le projet ne soit jamais
// inactif assez longtemps pour etre mis en pause automatiquement.
export async function GET() {
  try {
    const { error } = await supabase.from("parties").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}