/*
 * Verbindungsdaten zu deinem Supabase-Projekt.
 *
 * WICHTIG zum Verständnis: Der "anon key" ist bewusst dazu gedacht, öffentlich
 * im JavaScript-Code zu stehen (er landet im Browser jedes Besuchers und ist
 * damit sowieso einsehbar) - das ist bei Supabase so gewollt und kein
 * Sicherheitsproblem. Der eigentliche Schutz kommt NICHT aus der Geheimhaltung
 * dieses Keys, sondern aus zwei Dingen:
 *   1. Row Level Security (RLS) in der Datenbank (siehe supabase-schema.sql) -
 *      ohne gültigen Login lässt die Datenbank selbst gar keinen Zugriff zu.
 *   2. Dem Login (Familienpasswort), das du im Supabase-Dashboard unter
 *      "Authentication" als einen einzigen gemeinsamen Account anlegst.
 *
 * Trage hier die Werte aus deinem Supabase-Projekt ein (Dashboard ->
 * Project Settings -> API):
 */

const SUPABASE_URL = "https://rpfmpjkzhgmrkkyrnluo.supabase.co";          // z.B. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_ILadB6hygvwp8cZHt-Tqeg_9RaDDKus";        // langer String, beginnt meist mit "eyJ..."

// Die E-Mail-Adresse des EINEN gemeinsamen Familien-Accounts, den du unter
// "Authentication" -> "Users" -> "Add user" im Supabase-Dashboard anlegst.
// Nach außen (für die Familie) taucht diese E-Mail nie auf - die Login-Seite
// zeigt nur ein Passwortfeld, im Hintergrund wird diese feste Adresse benutzt.
const FAMILY_EMAIL = "familie@chalet-holland.local";

