-- Datenbankschema für den Chalet-Belegungsplaner (Supabase / Postgres).
-- Ausführen im Supabase-Dashboard unter "SQL Editor" -> "New query" -> einfügen -> "Run".
--
-- Warum eine Datenbank-Einschränkung (EXCLUDE CONSTRAINT) statt nur eine
-- Prüfung im JavaScript-Code? Weil die Supabase-API direkt übers Internet
-- erreichbar ist (abgesichert über Login + Row-Level-Security, siehe unten) -
-- jede Prüfung, die NUR im Browser-JavaScript passiert, könnte theoretisch
-- umgangen werden (z.B. direkter API-Aufruf ohne unsere Webseite). Die
-- Datenbank selbst lässt deshalb gar keine zwei sich überschneidenden
-- Buchungen zu, unabhängig davon, woher die Anfrage kommt. Das ist sogar
-- strenger/sicherer als die ursprüngliche Flask-Version.

-- "btree_gist" wird für die Überschneidungs-Prüfung auf Datumsbereichen benötigt.
create extension if not exists btree_gist;

create table if not exists bookings (
  id          bigint generated always as identity primary key,
  von         date not null,
  bis         date not null,
  name        text not null,
  notiz       text default '',
  created_at  timestamptz not null default now(),

  -- "Bis" darf nicht vor "Von" liegen.
  constraint valid_dates check (bis >= von),

  -- Verhindert zwei Buchungen mit überschneidendem Zeitraum auf
  -- Datenbank-Ebene. daterange(von, bis, '[]') macht aus den beiden Spalten
  -- einen Bereich, bei dem Start UND Ende eingeschlossen sind (deshalb '[]'),
  -- && prüft auf Überlappung zweier solcher Bereiche.
  constraint no_overlapping_bookings exclude using gist (daterange(von, bis, '[]') with &&)
);

-- Row Level Security aktivieren: ohne gültige Policy darf NIEMAND lesen/schreiben,
-- auch nicht mit dem (öffentlichen) anon-Key. Die Policies unten erlauben
-- Zugriff nur für eingeloggte ("authenticated") Nutzer - und eingeloggt kann
-- sich nur jemand, der das Familienpasswort kennt (siehe README).
alter table bookings enable row level security;

create policy "Eingeloggte Nutzer können Buchungen lesen"
  on bookings for select
  to authenticated
  using (true);

create policy "Eingeloggte Nutzer können Buchungen anlegen"
  on bookings for insert
  to authenticated
  with check (true);

create policy "Eingeloggte Nutzer können Buchungen bearbeiten"
  on bookings for update
  to authenticated
  using (true);

create policy "Eingeloggte Nutzer können Buchungen löschen"
  on bookings for delete
  to authenticated
  using (true);
