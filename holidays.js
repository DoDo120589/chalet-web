/*
 * Feiertagsberechnung: NRW (Deutschland) + landesweite Niederlande.
 *
 * Warum im Frontend und nicht in der Datenbank? Feiertage sind eine reine
 * Funktion des Jahres (Ostern lässt sich mathematisch berechnen, siehe
 * Gauß'sche Osterformel unten) - es gibt nichts zu speichern, es muss nur
 * bei Bedarf für das jeweils angezeigte Jahr neu berechnet werden. Das
 * spart eine Datenbanktabelle und funktioniert für jedes beliebige Jahr,
 * nicht nur für vorab eingetragene.
 *
 * Deutschland: NRW hat u.a. Fronleichnam als zusätzlichen Feiertag
 * gegenüber vielen anderen Bundesländern - das ist hier berücksichtigt.
 * Niederlande: Feiertage gelten bundesweit einheitlich, keine Provinz-
 * Unterschiede (anders als in Deutschland).
 */

function getHolidays(year) {
  // Ostersonntag nach der Gauß'schen Osterformel.
  const ga = year % 19, gb = Math.floor(year / 100), gc = year % 100;
  const gd = Math.floor(gb / 4), ge = gb % 4, gf = Math.floor((gb + 8) / 25);
  const gg = Math.floor((gb - gf + 1) / 3), gh = (19 * ga + gb - gd - gg + 15) % 30;
  const gi = Math.floor(gc / 4), gk = gc % 4;
  const gl = (32 + 2 * ge + 2 * gi - gh - gk) % 7;
  const gm = Math.floor((ga + 11 * gh + 22 * gl) / 451);
  const month = Math.floor((gh + gl - 7 * gm + 114) / 31);
  const day = ((gh + gl - 7 * gm + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function fmt(d) {
    return d.toISOString().split("T")[0];
  }

  // Niederländische Feiertage (landesweit einheitlich)
  const nl = {};
  nl[fmt(new Date(year, 0, 1))]   = "Nieuwjaarsdag";
  nl[fmt(addDays(easter, -2))]    = "Goede Vrijdag";
  nl[fmt(easter)]                 = "1. Paasdag";
  nl[fmt(addDays(easter, 1))]     = "2. Paasdag";
  nl[fmt(new Date(year, 3, 27))]  = "Koningsdag";
  nl[fmt(new Date(year, 4, 5))]   = "Bevrijdingsdag";
  nl[fmt(addDays(easter, 39))]    = "Hemelvaartsdag";
  nl[fmt(addDays(easter, 49))]    = "1. Pinksterdag";
  nl[fmt(addDays(easter, 50))]    = "2. Pinksterdag";
  nl[fmt(new Date(year, 11, 25))] = "1. Kerstdag";
  nl[fmt(new Date(year, 11, 26))] = "2. Kerstdag";

  // Deutsche Feiertage (Bundesland NRW)
  const de = {};
  de[fmt(new Date(year, 0, 1))]   = "Neujahr";
  de[fmt(addDays(easter, -2))]    = "Karfreitag";
  de[fmt(addDays(easter, 1))]     = "Ostermontag";
  de[fmt(new Date(year, 4, 1))]   = "Tag der Arbeit";
  de[fmt(addDays(easter, 39))]    = "Christi Himmelfahrt";
  de[fmt(addDays(easter, 50))]    = "Pfingstmontag";
  de[fmt(addDays(easter, 60))]    = "Fronleichnam";       // NRW-spezifisch
  de[fmt(new Date(year, 9, 3))]   = "Tag d. Deutschen Einheit";
  de[fmt(new Date(year, 10, 1))]  = "Allerheiligen";       // NRW-spezifisch
  de[fmt(new Date(year, 11, 25))] = "1. Weihnachtstag";
  de[fmt(new Date(year, 11, 26))] = "2. Weihnachtstag";

  // Zusammenführen: an Tagen, die in beiden Ländern Feiertag sind (z.B.
  // Neujahr, Ostermontag, Weihnachten), werden beide Flaggen angezeigt.
  const result = {};
  for (const [date, label] of Object.entries(nl)) {
    result[date] = "🇳🇱 " + label;
  }
  for (const [date, label] of Object.entries(de)) {
    if (!result[date]) {
      result[date] = "🇩🇪 " + label;
    } else {
      result[date] += " / 🇩🇪 " + label;
    }
  }

  return result;
}
