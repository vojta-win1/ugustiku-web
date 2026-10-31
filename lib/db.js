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

/* =====================================================================
   Zápis – používá jen administrace
   ===================================================================== */

const MAX_JIDEL_NA_DEN = 30;
const MAX_DELKA_TEXTU = 200;

/**
 * Prohlédne data z editoru, než se uloží.
 *
 * Nikdy nevěříme tomu, co přijde z prohlížeče – i když to posílá náš
 * vlastní editor. Stačí chyba v JavaScriptu nebo někdo, kdo si pohraje
 * s vývojářskými nástroji, a do databáze by se dostal nesmysl.
 *
 * @returns {{ok: true, dny: Array} | {ok: false, chyba: string}}
 */
export function overDataTydne(vstup) {
  if (!Array.isArray(vstup) || vstup.length !== 5) {
    return { ok: false, chyba: 'Týden musí mít pět dnů (pondělí až pátek).' };
  }

  const dny = [];

  for (let i = 0; i < 5; i++) {
    const d = vstup[i] || {};
    const poznamka = String(d.poznamka ?? '').trim().slice(0, MAX_DELKA_TEXTU);

    const jidla = [];
    for (const j of Array.isArray(d.jidla) ? d.jidla : []) {
      const nazev = String(j?.nazev ?? '').trim().slice(0, MAX_DELKA_TEXTU);
      // Prázdné jídlo není chyba – jen právě přidaný, ještě nevyplněný řádek.
      if (!nazev) continue;

      if (j.typ !== 'polevka' && j.typ !== 'hlavni') {
        return { ok: false, chyba: `Jídlo „${nazev}“ má neznámý typ.` };
      }

      const cena = Number(j.cena);
      if (!Number.isInteger(cena) || cena < 0 || cena > 100000) {
        return { ok: false, chyba: `Cena u „${nazev}“ musí být celé číslo v korunách.` };
      }

      const alergeny = (Array.isArray(j.alergeny) ? j.alergeny : [])
        .map((a) => String(a))
        .filter((a) => /^([1-9]|1[0-4])$/.test(a));

      jidla.push({
        typ: j.typ,
        nazev,
        cena,
        alergeny: [...new Set(alergeny)].sort((a, b) => a - b),
        bezMasa: !!j.bezMasa,
      });

      if (jidla.length > MAX_JIDEL_NA_DEN) {
        return { ok: false, chyba: `Na jeden den je nejvýš ${MAX_JIDEL_NA_DEN} jídel.` };
      }
    }

    dny.push({ cislo: i + 1, zavreno: !!d.zavreno, poznamka, jidla });
  }

  return { ok: true, dny };
}

/**
 * Uloží celý týden – přepíše ho načisto.
 *
 * Všechny příkazy jdou do databáze jako jedna dávka, kterou D1 provede
 * jako transakci. Buď se povede všechno, nebo nic: nemůže se stát, že by
 * se smazala stará jídla a nová se neuložila.
 *
 * Jídla se nevyhledávají podle id dne – id se dotáhne rovnou v příkazu
 * poddotazem. Díky tomu stačí jediná cesta do databáze.
 */
export async function ulozTyden(db, pondeli, dny) {
  const prikazy = [
    db
      .prepare(
        "INSERT INTO tydny (pondeli) VALUES (?) ON CONFLICT(pondeli) DO UPDATE SET upraveno_v = datetime('now')"
      )
      .bind(pondeli),
  ];

  for (const den of dny) {
    prikazy.push(
      db
        .prepare(
          `INSERT INTO dny (tyden_id, den, zavreno, poznamka)
           SELECT id, ?, ?, ? FROM tydny WHERE pondeli = ?
           ON CONFLICT(tyden_id, den) DO UPDATE
             SET zavreno = excluded.zavreno, poznamka = excluded.poznamka`
        )
        .bind(den.cislo, den.zavreno ? 1 : 0, den.poznamka, pondeli)
    );
  }

  prikazy.push(
    db
      .prepare(
        `DELETE FROM jidla WHERE den_id IN
           (SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli = ?)`
      )
      .bind(pondeli)
  );

  for (const den of dny) {
    den.jidla.forEach((j, poradi) => {
      prikazy.push(
        db
          .prepare(
            `INSERT INTO jidla (den_id, poradi, typ, nazev, cena, alergeny, bez_masa)
             SELECT d.id, ?, ?, ?, ?, ?, ?
               FROM dny d JOIN tydny t ON t.id = d.tyden_id
              WHERE t.pondeli = ? AND d.den = ?`
          )
          .bind(poradi + 1, j.typ, j.nazev, j.cena, j.alergeny.join(','), j.bezMasa ? 1 : 0, pondeli, den.cislo)
      );
    });
  }

  await db.batch(prikazy);
}

/** Zveřejní týden na webu, nebo ho zase stáhne. */
export async function nastavZverejneni(db, pondeli, zverejnit) {
  await db
    .prepare(
      `UPDATE tydny
          SET zverejneno = ?,
              zverejneno_v = CASE WHEN ? = 1 THEN COALESCE(zverejneno_v, datetime('now')) ELSE zverejneno_v END,
              upraveno_v = datetime('now')
        WHERE pondeli = ?`
    )
    .bind(zverejnit ? 1 : 0, zverejnit ? 1 : 0, pondeli)
    .run();
}

/**
 * Zkopíruje jídla z minulého týdne jako výchozí bod.
 * Nic nezveřejňuje – zůstává to konceptem, dokud se nezmáčkne Zveřejnit.
 */
export async function zkopirujMinulyTyden(db, pondeli, minulePondeli) {
  const minuly = await nactiTyden(db, minulePondeli);
  if (!minuly) return { ok: false, chyba: 'Minulý týden v databázi není, není co kopírovat.' };

  const maObsah = minuly.dny.some((d) => d.jidla.length > 0 || d.zavreno);
  if (!maObsah) return { ok: false, chyba: 'Minulý týden je prázdný, není co kopírovat.' };

  await ulozTyden(db, pondeli, minuly.dny);
  return { ok: true };
}
