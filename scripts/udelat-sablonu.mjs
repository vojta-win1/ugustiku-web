/*
  Vyrobí lib/sablona.js ze schváleného návrhu navrh/index.html.

  Proč skriptem a ne ručně: návrh je přes 1 MB (fotky jsou v něm vložené
  jako base64) a ručním přepisováním by se snadno něco ztratilo. Takhle
  se dá šablona kdykoli vygenerovat znovu – třeba když se návrh upraví.

  Co se mění:
    – base64 fotky  ->  /obrazky/*.jpg
    – <style>       ->  /styl.css
    – <script>      ->  /web.js
    – Google Fonts  ->  pryč (písma máme vlastní, viz stahnout-pisma.mjs)
    – tři místa se vymění za data z databáze

  Spuštění:  node scripts/udelat-sablonu.mjs
*/

import { readFile, writeFile } from 'node:fs/promises';

const ZDROJ = 'navrh/index.html';
const CIL = 'lib/sablona.js';

// Pořadí fotek tak, jak se v návrhu vyskytují (některé se opakují).
const FOTKY = ['babovka', 'sekana', 'bagety', 'babovka', 'bagety', 'sekana'];

let h = await readFile(ZDROJ, 'utf8');

let i = 0;
h = h.replace(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g, () => `/obrazky/${FOTKY[i++]}.jpg`);
if (i !== FOTKY.length) throw new Error(`Čekal jsem ${FOTKY.length} fotek, našel ${i}.`);

h = h
  .replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n', '')
  .replace('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n', '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, '')
  // zbytek po návrhovém nástroji, na ostrém webu nemá co dělat
  .replace(/<meta name="claude:[^>]*>\n/g, '')
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/styl.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="/web.js" defer></script>')
  .replace(
    '<a class="flink" href="#top">Přihlášení pro správce</a>',
    '<a class="flink" href="/admin">Přihlášení pro správce</a>'
  )
  // místa, kam se doplní data
  .replace('<title>U Gustíků</title>', '<title>${d.titulek}</title>')
  .replace(
    '<div class="cardhead"><h2 class="display" id="today-h">Dnes na talíři</h2><span id="today-d"></span></div>\n    <div id="today-list"></div>',
    '${d.karta}'
  )
  .replace(/<section class="menu" id="listek"[\s\S]*?<\/section>/, '${d.listek}');

const telo = h.match(/<!doctype html>[\s\S]*<\/html>/)[0];

for (const [co, kolik] of [['${d.titulek}', 1], ['${d.karta}', 1], ['${d.listek}', 1]]) {
  if (telo.split(co).length - 1 !== kolik) throw new Error(`Značka ${co} se nenašla.`);
}
if (telo.includes('base64')) throw new Error('V těle zůstala base64 fotka.');
// Tělo se vkládá do template literalu, takže v něm nesmí být ` ani zpětné lomítko.
if (/[`\\]/.test(telo)) throw new Error('V těle je ` nebo zpětné lomítko – rozbilo by to šablonu.');

const soubor = `/*
  Šablona veřejné stránky.

  Tělo je převzaté ze schváleného návrhu (navrh/index.html). Změnilo se jen tohle:
    – fotky už nejsou vložené jako base64, ale načítají se z /obrazky/
    – styl je v /styl.css, skript v /web.js
    – písma se berou z /pisma/, ne z Google Fonts
    – na třech místech se doplňují data z databáze: titulek stránky,
      úvodní karta a celá sekce s jídelním lístkem

  POZOR: soubor generuje scripts/udelat-sablonu.mjs. Ruční úpravy tady
  zmizí, až se skript pustí znovu – opravuj radši návrh nebo ten skript.
*/

/**
 * Složí celou stránku.
 * @param {{titulek: string, karta: string, listek: string}} d
 */
export function strankaHtml(d) {
  return \`${telo}\`;
}
`;

await writeFile(CIL, soubor);
console.log(`${CIL} hotovo – ${Math.round(soubor.length / 1024)} kB`);
