/*
  Čtení z databáze D1.

  Týden se načítá jedním dotazem i s jídly (LEFT JOIN) a teprve v
  JavaScriptu se poskládá do struktury. Je to rychlejší než pět dotazů
  a hlavně to šetří počet čtení, které se na free tarifu počítají.
*/

import { NAZVY_DNU } from './datum.js';

/**
 * Načte týden podle data pondělí.
 * Vrací null, pokud takový týden v databázi vůbec není.
 *
 * Výsledek má vždycky všech pět dnů (1–5), i kdyby v databázi
 * některý chyběl – zbytek programu se tak nemusí ptát, jestli den existuje.
 */
export async function nactiTyden(db, pondeli) {
  const tyden = await db
    .prepare('SELECT id, pondeli, zverejneno, zverejneno_v, upraveno_v FROM tydny WHERE pondeli = ?')
    .bind(pondeli)
    .first();

  if (!tyden) return null;

  const { results } = await db
    .prepare(
      `SELECT d.den, d.zavreno, d.poznamka,
              j.typ, j.nazev, j.cena, j.alergeny, j.bez_masa
         FROM dny d
         LEFT JOIN jidla j ON j.den_id = d.id
        WHERE d.tyden_id = ?
        ORDER BY d.den, j.poradi, j.id`
    )
    .bind(tyden.id)
    .all();

  const dny = NAZVY_DNU.map((_, i) => ({
    cislo: i + 1,
    zavreno: false,
    poznamka: '',
    jidla: [],
  }));

  for (const r of results) {
    const den = dny[r.den - 1];
    if (!den) continue;
    den.zavreno = r.zavreno === 1;
    den.poznamka = r.poznamka || '';
    // LEFT JOIN vrátí řádek i pro den bez jídel – ten poznáme podle prázdného názvu.
    if (r.nazev) {
      den.jidla.push({
        typ: r.typ,
        nazev: r.nazev,
        cena: r.cena,
        alergeny: r.alergeny ? r.alergeny.split(',').filter(Boolean) : [],
        bezMasa: r.bez_masa === 1,
      });
    }
  }

  return {
    pondeli: tyden.pondeli,
    zverejneno: tyden.zverejneno === 1,
    upravenoV: tyden.upraveno_v,
    dny,
  };
}

/** Načte týden jen tehdy, je-li zveřejněný. Pro veřejný web. */
export async function nactiZverejnenyTyden(db, pondeli) {
  const t = await nactiTyden(db, pondeli);
  return t && t.zverejneno ? t : null;
}
