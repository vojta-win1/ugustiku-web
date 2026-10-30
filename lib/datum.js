/*
  Práce s datem a českým časem.

  Důležité: server Cloudflare běží v UTC, ale my potřebujeme vědět,
  jaký je den v Praze. Proto se dnešek nezjišťuje přes new Date(),
  ale přes Intl s časovou zónou Europe/Prague – ta řeší i letní čas.

  Datum se všude uvnitř programu předává jako text 'YYYY-MM-DD'.
  Je to jednoduché, dá se porovnávat, řadit a ukládat do databáze.
*/

export const NAZVY_DNU = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
export const ZKRATKY_DNU = ['Po', 'Út', 'St', 'Čt', 'Pá'];

/** Dnešní datum v Praze jako 'YYYY-MM-DD'. */
export function dnesVPraze(ted = new Date()) {
  // 'en-CA' je trik: tenhle formát vypisuje datum přesně jako 2026-10-30.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ted);
}

/*
  Datum si převádíme na Date s časem 12:00 UTC. V poledne je bezpečná
  vzdálenost od obou konců dne, takže posun o časovou zónu nebo letní
  čas nikdy nepřehodí datum na sousední den.
*/
const naDatum = (iso) => new Date(iso + 'T12:00:00Z');

/** Den v týdnu: 1 = pondělí … 7 = neděle. */
export function denVTydnu(iso) {
  return ((naDatum(iso).getUTCDay() + 6) % 7) + 1;
}

/** Posune datum o zadaný počet dnů (klidně záporný). */
export function posunDnu(iso, oKolik) {
  const d = naDatum(iso);
  d.setUTCDate(d.getUTCDate() + oKolik);
  return d.toISOString().slice(0, 10);
}

/** Pondělí toho týdne, do kterého datum spadá. */
export function pondeliTydne(iso) {
  return posunDnu(iso, -(denVTydnu(iso) - 1));
}

/** Je to platné datum ve tvaru 'YYYY-MM-DD'? */
export function jePlatneDatum(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(naDatum(iso).getTime()) && naDatum(iso).toISOString().slice(0, 10) === iso;
}

const rozlozit = (iso) => {
  const [r, m, d] = iso.split('-');
  return { rok: +r, mesic: +m, den: +d };
};

/** '30. 10.' – krátký zápis pro záložky a nadpisy. */
export function kratkeDatum(iso) {
  const { mesic, den } = rozlozit(iso);
  return `${den}. ${mesic}.`;
}

/** 'Pondělí 2. 11.' – nadpis dne. Index 0 = pondělí. */
export function popisDne(pondeli, index) {
  return `${NAZVY_DNU[index]} ${kratkeDatum(posunDnu(pondeli, index))}`;
}

/**
 * Rozsah týdne pro nadpis lístku. Zvládne i přelom měsíce a roku:
 *   '26.–30. 10. 2026'
 *   '30. 11. – 4. 12. 2026'
 *   '28. 12. 2026 – 1. 1. 2027'
 */
export function rozsahTydne(pondeli) {
  const a = rozlozit(pondeli);
  const b = rozlozit(posunDnu(pondeli, 4));
  if (a.rok !== b.rok) return `${a.den}. ${a.mesic}. ${a.rok} – ${b.den}. ${b.mesic}. ${b.rok}`;
  if (a.mesic !== b.mesic) return `${a.den}. ${a.mesic}. – ${b.den}. ${b.mesic}. ${b.rok}`;
  return `${a.den}.–${b.den}. ${b.mesic}. ${b.rok}`;
}
