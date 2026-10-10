/*
 * Chalet-Belegungsplaner – Frontend-Logik (GitHub Pages + Supabase Version)
 * ============================================================================
 *
 * Diese Version braucht keinen eigenen Server mehr: Die komplette Logik läuft
 * im Browser, Daten liegen in einer Supabase-Datenbank (kostenlos gehostet).
 * Login funktioniert über einen einzigen gemeinsamen Supabase-Auth-Account
 * (siehe config.js) - die Familie sieht nach außen nur ein Passwortfeld,
 * im Hintergrund wird supabaseClient.auth.signInWithPassword() mit der festen
 * FAMILY_EMAIL aufgerufen.
 *
 * Sicherheit: Row Level Security (siehe supabase-schema.sql) sorgt dafür,
 * dass die Datenbank Lese-/Schreibzugriffe nur für eingeloggte Nutzer erlaubt
 * - unabhängig davon, dass der "anon key" hier im Code öffentlich sichtbar
 * ist (das ist bei Supabase so gewollt, siehe config.js).
 */

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bookings = [];
let cur = new Date();
cur.setDate(1);
let calendarLoaded = false;

// ── HELPERS ──────────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().split("T")[0]; }

function formatDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBooked(dateStr) {
  return bookings.find((b) => dateStr >= b.von && dateStr <= b.bis);
}

// Freundliche Fehlermeldung aus einem Supabase/Postgres-Fehler ableiten.
// 23P01 = "exclusion_violation" -> genau der Fall, dass sich unsere
// Datenbank-Einschränkung (siehe supabase-schema.sql) meldet, weil sich der
// Zeitraum mit einer bestehenden Buchung überschneidet.
function friendlyError(error) {
  if (!error) return "Unbekannter Fehler.";
  if (error.code === "23P01") {
    return "Dieser Zeitraum überschneidet sich mit einer bestehenden Buchung.";
  }
  if (error.code === "23514") {
    return "Das 'Bis'-Datum muss nach dem 'Von'-Datum liegen.";
  }
  return error.message || "Unbekannter Fehler.";
}

// ── AUTH ─────────────────────────────────────────────────────────────────
async function checkPw() {
  const val = document.getElementById("pw-input").value;
  const errEl = document.getElementById("pw-error");
  const btn = document.getElementById("login-btn");
  btn.disabled = true;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: FAMILY_EMAIL,
    password: val,
  });

  btn.disabled = false;

  if (error) {
    errEl.style.display = "block";
    document.getElementById("pw-input").value = "";
    document.getElementById("pw-input").focus();
    return;
  }

  showApp();
}

async function logout() {
  await supabaseClient.auth.signOut();
  showLogin();
}

function showLogin() {
  document.getElementById("login").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

function showApp() {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  // Schnell-Check ist die Startansicht nach dem Login.
  switchTab("quickcheck");
}

// Beim Laden der Seite prüfen, ob schon eine gültige Sitzung existiert
// (supabase-js speichert die Sitzung automatisch im Browser, daher bleibt
// man eingeloggt, auch nach Schließen des Browsers).
async function initAuth() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showApp();
  } else {
    showLogin();
  }
}

document.getElementById("login-btn").addEventListener("click", checkPw);
document.getElementById("pw-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkPw();
});
document.getElementById("logout-btn").addEventListener("click", logout);

// ── TAB-UMSCHALTUNG (Schnell-Check <-> Kalender) ───────────────────────────
function switchTab(name) {
  const isQuick = name === "quickcheck";
  document.getElementById("view-quickcheck").style.display = isQuick ? "block" : "none";
  document.getElementById("view-calendar").style.display = isQuick ? "none" : "block";
  document.getElementById("tab-quickcheck").classList.toggle("active", isQuick);
  document.getElementById("tab-calendar").classList.toggle("active", !isQuick);

  if (isQuick) {
    // Schnell-Check immer frisch zeigen, falls zuvor eine Buchung
    // abgeschlossen wurde (sonst bliebe die "Gebucht!"-Erfolgsmeldung
    // stehen, wenn man später wieder zu diesem Tab zurückkehrt).
    resetQuickCheckView();
  }

  if (!isQuick && !calendarLoaded) {
    calendarLoaded = true;
    loadBookingsAndRenderCalendar();
  }
}

function resetQuickCheckView() {
  document.querySelector("#view-quickcheck .check-card").style.display = "block";
  document.getElementById("success-card").style.display = "none";
  resultPanel.className = "result-panel";
  bookingForm.style.display = "none";
}

document.getElementById("tab-quickcheck").addEventListener("click", (e) => {
  e.preventDefault();
  switchTab("quickcheck");
});
document.getElementById("tab-calendar").addEventListener("click", (e) => {
  e.preventDefault();
  switchTab("calendar");
});
document.getElementById("success-to-calendar").addEventListener("click", () => {
  switchTab("calendar");
});

// ── SCHNELL-CHECK ────────────────────────────────────────────────────────
const vonInput = document.getElementById("q-von");
const bisInput = document.getElementById("q-bis");
const resultPanel = document.getElementById("result-panel");
const resultTitle = document.getElementById("result-title");
const resultDetail = document.getElementById("result-detail");
const bookingForm = document.getElementById("booking-form");

async function runCheck() {
  const von = vonInput.value;
  const bis = bisInput.value;

  resultPanel.className = "result-panel";
  bookingForm.style.display = "none";

  if (!von || !bis) return;

  if (bis < von) {
    resultPanel.classList.add("unavailable");
    resultTitle.textContent = "Ungültiger Zeitraum";
    resultDetail.textContent = "'Bis' muss nach 'Von' liegen.";
    return;
  }

  // Überschneidung suchen: eine bestehende Buchung überlappt mit [von, bis],
  // wenn ihr Start <= unser Ende UND ihr Ende >= unser Start ist.
  const { data, error } = await supabaseClient
    .from("bookings")
    .select("*")
    .lte("von", bis)
    .gte("bis", von)
    .limit(1);

  if (error) {
    resultPanel.classList.add("unavailable");
    resultTitle.textContent = "Fehler";
    resultDetail.textContent = friendlyError(error);
    return;
  }

  if (data.length === 0) {
    resultPanel.classList.add("available");
    resultTitle.textContent = "🎉 Frei!";
    resultDetail.textContent = `${formatDate(von)} – ${formatDate(bis)} ist noch nicht belegt.`;
    bookingForm.style.display = "block";
  } else {
    resultPanel.classList.add("unavailable");
    resultTitle.textContent = "Schon belegt";
    const c = data[0];
    resultDetail.textContent = `Überschneidet sich mit der Buchung von ${c.name} (${formatDate(c.von)} – ${formatDate(c.bis)}).`;
  }
}

vonInput.addEventListener("change", runCheck);
bisInput.addEventListener("change", runCheck);

document.getElementById("q-book-btn").addEventListener("click", async () => {
  const von = vonInput.value;
  const bis = bisInput.value;
  const name = document.getElementById("q-name").value.trim();
  const notiz = document.getElementById("q-notiz").value.trim();
  const errorEl = document.getElementById("q-error");

  errorEl.style.display = "none";

  if (!name) {
    errorEl.textContent = "Bitte deinen Namen eintragen.";
    errorEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("q-book-btn");
  btn.disabled = true;
  btn.textContent = "Wird gespeichert...";

  const { error } = await supabaseClient.from("bookings").insert({ von, bis, name, notiz });

  btn.disabled = false;
  btn.textContent = "Jetzt buchen";

  if (error) {
    errorEl.textContent = friendlyError(error);
    errorEl.style.display = "block";
    return;
  }

  calendarLoaded = false; // Kalender beim nächsten Ansehen neu laden
  document.querySelector("#view-quickcheck .check-card").style.display = "none";
  document.getElementById("success-card").style.display = "block";
});

// ── KALENDER ─────────────────────────────────────────────────────────────
async function loadBookingsAndRenderCalendar() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = '<div class="loading">Buchungen werden geladen...</div>';

  const { data, error } = await supabaseClient.from("bookings").select("*").order("von");
  bookings = error ? [] : data;
  renderCalendar();
}

function renderCalendar() {
  const y = cur.getFullYear(), m = cur.getMonth();
  const holidays = getHolidays(y);
  const today = toISO(new Date());

  document.getElementById("month-title").textContent =
    cur.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  let startDow = first.getDay();
  if (startDow === 0) startDow = 7;

  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  for (let i = 1; i < startDow; i++) {
    const el = document.createElement("div");
    el.className = "day empty";
    cal.appendChild(el);
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(y, m, d);
    const dow = date.getDay();
    const dateStr = toISO(date);
    const holiday = holidays[dateStr];
    const booking = isBooked(dateStr);
    const isToday = dateStr === today;
    const isWeekend = dow === 0 || dow === 6;

    const el = document.createElement("div");
    el.className = "day";
    if (booking) el.className += " booked";
    else if (holiday) el.className += " holiday";
    else if (isWeekend) el.className += " weekend";
    if (isToday) el.className += " today";

    const numDiv = document.createElement("div");
    numDiv.className = "day-num";
    numDiv.textContent = d;
    el.appendChild(numDiv);

    if (booking) {
      const lbl = document.createElement("div");
      lbl.className = "day-label";
      lbl.textContent = booking.name;
      el.appendChild(lbl);
      if (booking.notiz && dateStr === booking.von) {
        const note = document.createElement("div");
        note.className = "day-note";
        note.textContent = booking.notiz;
        el.appendChild(note);
      }
    }

    if (holiday && !booking) {
      const lbl = document.createElement("div");
      lbl.className = "day-label";
      lbl.textContent = holiday;
      el.appendChild(lbl);
    }

    el.onclick = booking ? () => showBooking(booking) : () => showNew(dateStr);
    cal.appendChild(el);
  }
}

document.getElementById("prev-btn").addEventListener("click", () => {
  cur.setMonth(cur.getMonth() - 1);
  renderCalendar();
});
document.getElementById("next-btn").addEventListener("click", () => {
  cur.setMonth(cur.getMonth() + 1);
  renderCalendar();
});

// ── MODAL ────────────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal-bg").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-bg").style.display = "none";
}

document.getElementById("modal-bg").addEventListener("click", (e) => {
  if (e.target.id === "modal-bg") closeModal();
});

// ── NEUE BUCHUNG (aus dem Kalender heraus) ─────────────────────────────────
function showNew(dateStr) {
  openModal(`
    <h3>Neue Buchung</h3>
    <div class="form-group"><label>Von</label><input type="date" id="f-von" value="${dateStr}"></div>
    <div class="form-group"><label>Bis</label><input type="date" id="f-bis" value="${dateStr}"></div>
    <div class="form-group"><label>Name</label><input type="text" id="f-name" placeholder="Dein Name" autocomplete="name"></div>
    <div class="form-group"><label>Notiz (optional)</label><textarea id="f-notiz" placeholder="z.B. Osterurlaub mit Kindern"></textarea></div>
    <div class="form-error" id="f-error"></div>
    <div class="btn-row">
      <button class="btn" id="cancel-btn">Abbrechen</button>
      <button class="btn primary" id="save-btn">Buchen</button>
    </div>
  `);
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("save-btn").addEventListener("click", saveNew);
  document.getElementById("f-name").focus();
}

async function saveNew() {
  const von = document.getElementById("f-von").value;
  const bis = document.getElementById("f-bis").value;
  const name = document.getElementById("f-name").value.trim();
  const notiz = document.getElementById("f-notiz").value.trim();
  const err = document.getElementById("f-error");
  const btn = document.getElementById("save-btn");

  if (!von || !bis || !name) {
    showError(err, "Bitte alle Pflichtfelder ausfüllen.");
    return;
  }

  btn.textContent = "Wird gespeichert...";
  btn.disabled = true;

  const { error } = await supabaseClient.from("bookings").insert({ von, bis, name, notiz });

  if (error) {
    showError(err, friendlyError(error));
    btn.textContent = "Buchen";
    btn.disabled = false;
    return;
  }

  closeModal();
  loadBookingsAndRenderCalendar();
}

// ── BUCHUNG ANSEHEN / BEARBEITEN / LÖSCHEN ────────────────────────────────
function showBooking(b) {
  openModal(`
    <h3>Buchungsdetails</h3>
    <div class="booking-info">
      <div class="name">${escHtml(b.name)}</div>
      <div class="dates">${formatDate(b.von)} – ${formatDate(b.bis)}</div>
      ${b.notiz ? `<div class="note">${escHtml(b.notiz)}</div>` : ""}
    </div>
    <div class="btn-row">
      <button class="btn danger" id="delete-btn">Löschen</button>
      <button class="btn" id="edit-btn">Bearbeiten</button>
      <button class="btn primary" id="close-btn">Schließen</button>
    </div>
  `);
  document.getElementById("delete-btn").addEventListener("click", () => deleteBooking(b.id));
  document.getElementById("edit-btn").addEventListener("click", () => editBooking(b));
  document.getElementById("close-btn").addEventListener("click", closeModal);
}

async function deleteBooking(id) {
  if (!confirm("Buchung wirklich löschen?")) return;
  const { error } = await supabaseClient.from("bookings").delete().eq("id", id);
  if (error) {
    alert("Fehler beim Löschen: " + friendlyError(error));
    return;
  }
  closeModal();
  loadBookingsAndRenderCalendar();
}

function editBooking(b) {
  openModal(`
    <h3>Buchung bearbeiten</h3>
    <div class="form-group"><label>Von</label><input type="date" id="f-von" value="${b.von}"></div>
    <div class="form-group"><label>Bis</label><input type="date" id="f-bis" value="${b.bis}"></div>
    <div class="form-group"><label>Name</label><input type="text" id="f-name" value="${escHtml(b.name)}"></div>
    <div class="form-group"><label>Notiz (optional)</label><textarea id="f-notiz">${escHtml(b.notiz || "")}</textarea></div>
    <div class="form-error" id="f-error"></div>
    <div class="btn-row">
      <button class="btn" id="cancel-btn">Abbrechen</button>
      <button class="btn primary" id="save-btn">Speichern</button>
    </div>
  `);
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("save-btn").addEventListener("click", () => saveEdit(b.id));
}

async function saveEdit(id) {
  const von = document.getElementById("f-von").value;
  const bis = document.getElementById("f-bis").value;
  const name = document.getElementById("f-name").value.trim();
  const notiz = document.getElementById("f-notiz").value.trim();
  const err = document.getElementById("f-error");
  const btn = document.getElementById("save-btn");

  if (!von || !bis || !name) {
    showError(err, "Bitte alle Pflichtfelder ausfüllen.");
    return;
  }

  btn.textContent = "Wird gespeichert...";
  btn.disabled = true;

  // Bei einer EXCLUDE-Constraint muss die bearbeitete Zeile selbst beim
  // Update kurz "aus dem Weg", sonst würde sie mit sich selbst kollidieren.
  // Supabase/Postgres prüft die Einschränkung aber erst NACH dem Update auf
  // die neuen Werte der Zeile mit dieser id - eine Kollision mit sich selbst
  // tritt dabei nicht auf, da es dieselbe Zeile ist (kein zweiter Eintrag).
  const { error } = await supabaseClient
    .from("bookings")
    .update({ von, bis, name, notiz })
    .eq("id", id);

  if (error) {
    showError(err, friendlyError(error));
    btn.textContent = "Speichern";
    btn.disabled = false;
    return;
  }

  closeModal();
  loadBookingsAndRenderCalendar();
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

// ── START ────────────────────────────────────────────────────────────────
initAuth();
