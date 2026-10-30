/*
  Stáhne písma z Google Fonts do public/pisma/ a vypíše hotové @font-face pravidla.

  Proč vůbec: písma nechceme tahat z googleapis.com. Jednak kvůli GDPR (každý
  návštěvník by tím posílal svoji IP adresu Googlu), jednak kvůli exportu —
  obrázek a PDF se generují v prohlížeči a do nich jde vložit jen písmo ze
  stejné domény jako stránka.

  Stahujeme podmnožinu "latin-ext". Obyčejný "latin" totiž neobsahuje ě š č ř ž ů,
  takže by v nadpisech chyběly háčky a čárky.

  Spuštění (stačí jednou, soubory pak jsou v gitu):
      node scripts/stahnout-pisma.mjs
*/

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const CIL = 'public/pisma';

// Prohlížeč, za který se vydáváme. Google Fonts podle toho pozná, že umíme
// woff2 a proměnlivá písma, a pošle nám ta nejmenší a nejmodernější.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PISMA = [
  {
    nazev: 'Bricolage Grotesque',
    soubor: 'bricolage-grotesque',
    url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap',
  },
  {
    nazev: 'Plus Jakarta Sans',
    soubor: 'plus-jakarta-sans',
    url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap',
  },
];

/* Z CSS od Googlu vytáhneme jen bloky pro latin a latin-ext. */
function bloky(css) {
  const out = [];
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css))) out.push({ podmnozina: m[1], blok: m[2] });
  return out.filter((b) => b.podmnozina === 'latin' || b.podmnozina === 'latin-ext');
}

const vyvolat = (b, klic) => (b.blok.match(new RegExp(klic + ':\\s*([^;]+);')) || [, ''])[1].trim();

await mkdir(CIL, { recursive: true });
const pravidla = [];

for (const pismo of PISMA) {
  const css = await fetch(pismo.url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const nalezene = bloky(css);
  if (!nalezene.length) throw new Error(`Pro ${pismo.nazev} nepřišla žádná použitelná podmnožina.`);

  for (const b of nalezene) {
    const url = (b.blok.match(/url\(([^)]+)\)/) || [])[1];
    const jmeno = `${pismo.soubor}-${b.podmnozina}.woff2`;
    const data = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    await writeFile(join(CIL, jmeno), data);
    console.log(`${jmeno}  ${Math.round(data.length / 1024)} kB`);

    pravidla.push(
      [
        '@font-face{',
        `  font-family:'${pismo.nazev}';`,
        `  font-style:normal;`,
        `  font-weight:${vyvolat(b, 'font-weight') || '400'};`,
        vyvolat(b, 'font-stretch') ? `  font-stretch:${vyvolat(b, 'font-stretch')};` : '',
        `  font-display:swap;`,
        `  src:url('/pisma/${jmeno}') format('woff2');`,
        `  unicode-range:${vyvolat(b, 'unicode-range')};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
}

console.log('\n--- vlož do public/styl.css ---\n');
console.log(pravidla.join('\n'));
