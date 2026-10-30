/*
  Zkouška pravidel pro výběr dne – který den se návštěvníkovi ukáže.

  Běží bez databáze a bez serveru: databáze je podvržená a dnešek se
  funkci podstrčí parametrem `ted`. Díky tomu jde ověřit i víkend nebo
  státní svátek, aniž by se musel přetáčet čas v počítači.

  Spuštění:  node scripts/test-vyber-dne.mjs
*/
import { vyberZobrazeni } from '../lib/listek.js';

function fakeDb(tydny) {
  return {
    prepare(sql) {
      return {
        bind(...a) {
          return {
            async first() {
              const t = tydny[a[0]];
              return t ? { id: a[0], pondeli: a[0], zverejneno: t.zverejneno, upraveno_v: '' } : null;
            },
            async all() {
              const t = tydny[a[0]];
              const results = [];
              for (let d = 1; d <= 5; d++) {
                const den = t.dny[d - 1];
                if (!den.jidla.length) {
                  results.push({ den: d, zavreno: den.zavreno ? 1 : 0, poznamka: den.poznamka || '', nazev: null });
                } else {
                  for (const j of den.jidla)
                    results.push({ den: d, zavreno: den.zavreno ? 1 : 0, poznamka: den.poznamka || '', typ: 'hlavni', nazev: j, cena: 170, alergeny: '1,7', bez_masa: 0 });
                }
              }
              return { results };
            },
          };
        },
      };
    },
  };
}

const jidlo = (n) => ({ zavreno: false, poznamka: '', jidla: [n] });
const zavreno = (p) => ({ zavreno: true, poznamka: p, jidla: [] });
const prazdno = () => ({ zavreno: false, poznamka: '', jidla: [] });

const db = fakeDb({
  '2026-10-26': { zverejneno: 1, dny: [jidlo('Po'), jidlo('Út'), jidlo('St'), jidlo('Čt'), jidlo('Pá')] },
  '2026-11-02': { zverejneno: 0, dny: [jidlo('Po'), jidlo('Út'), zavreno('Školení'), jidlo('Čt'), jidlo('Pá')] },
});

const dbVseVenku = fakeDb({
  '2026-11-02': { zverejneno: 1, dny: [jidlo('Po'), jidlo('Út'), zavreno('Státní svátek – zavřeno'), prazdno(), jidlo('Pá')] },
  '2026-11-09': { zverejneno: 1, dny: [jidlo('Po'), jidlo('Út'), jidlo('St'), jidlo('Čt'), jidlo('Pá')] },
});

const dbPatekZavreno = fakeDb({
  '2026-11-02': { zverejneno: 1, dny: [jidlo('Po'), jidlo('Út'), jidlo('St'), jidlo('Čt'), zavreno('Dovolená')] },
  '2026-11-09': { zverejneno: 1, dny: [jidlo('Po'), jidlo('Út'), jidlo('St'), jidlo('Čt'), jidlo('Pá')] },
});

// Čas 10:00 v Praze; v listopadu je UTC+1, tedy 09:00 UTC.
const v = (datum) => new Date(datum + 'T09:00:00Z');

const pripady = [
  ['pátek 30. 10. (běžný den)', db, v('2026-10-30'), {}, 'ok|2026-10-26|4|auto4|dnesek'],
  ['sobota 31. 10. – příští týden není venku', db, v('2026-10-31'), {}, 'nezverejneno|2026-11-02|pristi'],
  ['neděle 1. 11. – totéž', db, v('2026-11-01'), {}, 'nezverejneno|2026-11-02|pristi'],
  ['pondělí 2. 11.', dbVseVenku, v('2026-11-02'), {}, 'ok|2026-11-02|0|auto0|dnesek'],
  ['středa 4. 11. – zavřeno, čtvrtek prázdný → pátek', dbVseVenku, v('2026-11-04'), {}, 'ok|2026-11-02|4|auto4|jindy'],
  ['středa 4. 11. – uživatel klikne na středu, karta dál ukazuje pátek', dbVseVenku, v('2026-11-04'), { den: 'st' }, 'ok|2026-11-02|2|auto4|jindy'],
  ['pátek 6. 11. zavřený → pondělí příštího týdne', dbPatekZavreno, v('2026-11-06'), {}, 'ok|2026-11-09|0|auto0|jindy'],
  ['neděle 1. 11. s klikem na út – víkend skáče na příští týden', dbVseVenku, v('2026-11-01'), { den: 'ut' }, 'ok|2026-11-02|1|auto0|jindy'],
];

let chyb = 0;
for (const [popis, databaze, ted, param, ceka] of pripady) {
  const s = await vyberZobrazeni(databaze, { ...param, ted });
  const got =
    s.stav === 'ok'
      ? `ok|${s.pondeli}|${s.index}|auto${s.autoIndex}|${s.jeDnesek ? 'dnesek' : 'jindy'}`
      : `${s.stav}|${s.pondeli}|${s.jePristiTyden ? 'pristi' : 'tento'}`;
  const ok = got === ceka;
  if (!ok) chyb++;
  console.log(`${ok ? 'OK   ' : 'CHYBA'}  ${popis}`);
  if (!ok) {
    console.log(`          cekam ${ceka}`);
    console.log(`          mam   ${got}`);
  }
}
console.log('');
console.log(chyb ? chyb + ' pripadu neproslo' : 'Vsechno sedi.');
process.exit(chyb ? 1 : 0);
