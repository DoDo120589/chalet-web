# Chalet Holland – Belegungsplaner (GitHub Pages + Supabase)

Diese Version braucht keinen eigenen Server mehr. Die Seite liegt komplett
statisch auf GitHub Pages, die Daten liegen in einer kostenlosen
Supabase-Datenbank (Postgres mit fertiger API). Kein Raspberry Pi, kein
Portforwarding, kein VPN, keine laufenden Kosten.

## Architektur im Überblick

```
Familie (Handy/PC, Browser)
      │
      ▼
GitHub Pages (statische Seite: index.html, app.js, style.css, ...)
      │  JavaScript ruft direkt die Supabase-API auf
      ▼
Supabase (kostenlos gehostete Postgres-Datenbank + Login)
```

Warum sicher, obwohl der Datenbank-Zugangsschlüssel ("anon key") öffentlich
im JavaScript-Code steht? Weil bei Supabase nicht die Geheimhaltung dieses
Schlüssels schützt, sondern **Row Level Security (RLS)** direkt in der
Datenbank: Ohne gültigen Login lässt die Datenbank selbst keinen Zugriff zu,
egal welcher Schlüssel benutzt wird (siehe `supabase-schema.sql`). Außerdem
verhindert eine Datenbank-Einschränkung (`EXCLUDE CONSTRAINT`), dass sich
zwei Buchungen jemals überschneiden können – das ist sogar strenger als die
vorherige Flask-Version, weil es nicht im Browser-Code umgangen werden kann.

## 1) Supabase-Projekt anlegen (kostenlos)

1. Auf [supabase.com](https://supabase.com) ein kostenloses Konto anlegen
2. **New project** klicken, einen Namen vergeben (z. B. "chalet-holland"), ein
   Datenbank-Passwort setzen (brauchst du für diese Anleitung nicht noch mal,
   einfach sicher verwahren) und eine Region wählen (z. B. Frankfurt/EU)
3. Warten, bis das Projekt fertig eingerichtet ist (ca. 1–2 Minuten)

## 2) Datenbank-Tabelle anlegen

1. Im Supabase-Dashboard links auf **SQL Editor** klicken
2. **New query**
3. Den kompletten Inhalt von `supabase-schema.sql` (liegt in diesem Paket)
   einfügen
4. **Run** klicken – sollte ohne Fehler durchlaufen

## 3) Familien-Login anlegen

1. Im Dashboard links auf **Authentication** → **Users**
2. **Add user** → **Create new user**
3. E-Mail: `familie@chalet-holland.local` (oder eine andere, beliebige
   Adresse – muss nicht echt sein, wird nirgends eine Mail hinschicken)
4. Passwort: das gewünschte Familienpasswort
5. **Auto Confirm User** aktivieren (falls als Option angezeigt), damit der
   Account sofort nutzbar ist, ohne Bestätigungs-Mail
6. **Create user**

Falls du eine andere E-Mail als `familie@chalet-holland.local` gewählt hast:
in `config.js` bei `FAMILY_EMAIL` entsprechend anpassen (siehe Schritt 4).

## 4) Verbindungsdaten eintragen

1. Im Dashboard: **Project Settings** (Zahnrad-Symbol) → **API**
2. Dort stehen **Project URL** und **anon public** Key
3. In der Datei `config.js` (liegt in diesem Paket) eintragen:
   ```js
   const SUPABASE_URL = "https://deinprojekt.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...dein-key...";
   const FAMILY_EMAIL = "familie@chalet-holland.local";
   ```

## 5) Auf GitHub veröffentlichen

**Wichtig:** GitHub Pages funktioniert im kostenlosen Plan nur mit
**öffentlichen** Repositories. Das ist hier unproblematisch – es gibt keine
Geheimnisse mehr im Code (siehe Erklärung oben zum "anon key").

1. Neues Repository auf GitHub anlegen, **public**, z. B. `chalet-planner`
2. Alle Dateien aus diesem Paket hineinkopieren (außer dem `test/`-Ordner,
   der ist nur für die lokale Entwicklung/Testen gedacht, nicht für den
   Betrieb nötig)
3. Committen und pushen:
   ```bash
   git add .
   git commit -m "Umstellung auf GitHub Pages + Supabase"
   git push
   ```
4. Auf GitHub: **Settings** → **Pages** → unter "Build and deployment"
   als Source **"Deploy from a branch"**, Branch **main**, Ordner **/ (root)**
   auswählen → **Save**
5. Nach ein paar Minuten ist die Seite erreichbar unter
   `https://<dein-username>.github.io/<repo-name>/`

## 6) Testen

Seite aufrufen, mit dem Familienpasswort einloggen (Schritt 3), eine
Testbuchung über den Schnell-Check anlegen, zum Kalender wechseln und
prüfen, ob sie dort erscheint.

## Was ist mit dem Raspberry Pi?

Der wird für dieses Projekt nicht mehr gebraucht – du kannst ihn wieder für
etwas anderes nutzen (z. B. wieder RetroPie, oder ein neues Projekt).

## Lokale Tests (optional, nur für Weiterentwicklung)

Im `test/`-Ordner liegt ein automatisierter Testlauf, der die komplette App
gegen einen simulierten ("mock") Supabase-Client prüft, ganz ohne echtes
Supabase-Projekt. Nur relevant, falls du später selbst am Code
weiterentwickelst und prüfen willst, ob du etwas kaputt gemacht hast:
```bash
pip install playwright --break-system-packages
playwright install chromium
python3 test/run_test.py
```
