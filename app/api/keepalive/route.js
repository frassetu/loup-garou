import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

// Appelée une fois par jour par le cron Vercel (voir vercel.json).
// Fait une requête minime à Supabase pour que le projet ne soit jamais
// inactif assez longtemps pour être mis en pause automatiquement.
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