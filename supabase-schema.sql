-- A exécuter dans Supabase > SQL Editor > New query

create extension if not exists "pgcrypto";

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  statut text not null default 'lobby', -- 'lobby' | 'distribue' | 'terminee'
  roles_config jsonb not null default '{}'::jsonb, -- ex: {"loup-garou":2,"voyante":1,...}
  created_at timestamptz not null default now()
);

create table if not exists joueurs (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid not null references parties(id) on delete cascade,
  session_id text not null,
  nom text not null,
  role text,
  vivant boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_joueurs_partie on joueurs(partie_id);
create index if not exists idx_parties_code on parties(code);

-- Row Level Security : ce jeu n'a pas de compte utilisateur (juste un code de
-- partie + un pseudo), donc on ouvre les policies en lecture/écriture.
-- Le "secret" est simplement de ne pas partager le code de partie.
alter table parties enable row level security;
alter table joueurs enable row level security;

create policy "parties: lecture publique" on parties for select using (true);
create policy "parties: creation publique" on parties for insert with check (true);
create policy "parties: mise a jour publique" on parties for update using (true);

create policy "joueurs: lecture publique" on joueurs for select using (true);
create policy "joueurs: creation publique" on joueurs for insert with check (true);
create policy "joueurs: mise a jour publique" on joueurs for update using (true);
create policy "joueurs: suppression publique" on joueurs for delete using (true);

-- Active le Realtime sur les deux tables
alter publication supabase_realtime add table parties;
alter publication supabase_realtime add table joueurs;
