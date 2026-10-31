/*
  Stáhne knihovny pro export do public/admin/vendor/.

  Proč si je necháváme u sebe a netaháme je z cizího serveru (CDN):
    – export funguje, i kdyby CDN vypadla nebo změnila obsah
    – nic se neposílá cizím serverům (GDPR)
    – obsahová politika stránky (CSP) může zůstat přísná: 'self'

  Soubory jsou v gitu, takže tohle potřebuješ pustit jen při aktualizaci.

  Spuštění:  node scripts/stahnout-knihovny.mjs
*/

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const CIL = 'public/admin/vendor';

const KNIHOVNY = [
  {
    nazev: 'html-to-image',
    verze: '1.11.13',
    cesta: 'dist/html-to-image.js',
    soubor: 'html-to-image.js',
    licence: 'MIT',
    kcemu: 'udělá z kusu stránky obrázek PNG',
    overit: 'htmlToImage',
  },
  {
    nazev: 'jspdf',
    verze: '4.2.1',
    cesta: 'dist/jspdf.umd.min.js',
    soubor: 'jspdf.umd.min.js',
    licence: 'MIT',
    kcemu: 'složí PDF ve formátu A4',
    overit: 'jspdf',
  },
];

await mkdir(CIL, { recursive: true });
const radky = [];

for (const k of KNIHOVNY) {
  const url = `https://unpkg.com/${k.nazev}@${k.verze}/${k.cesta}`;
  const odpoved = await fetch(url);
  if (!odpoved.ok) throw new Error(`${url} → ${odpoved.status}`);

  const kod = await odpoved.text();
  // Hrubá pojistka, že nám nepřišla chybová stránka místo knihovny.
  if (kod.length < 10000 || kod.includes('<!DOCTYPE html>')) {
    throw new Error(`${k.nazev}: stažený soubor nevypadá jako knihovna.`);
  }

  await writeFile(join(CIL, k.soubor), kod);
  console.log(`${k.soubor.padEnd(22)} ${Math.round(kod.length / 1024)} kB`);
  radky.push(`${k.soubor}\n    ${k.nazev} ${k.verze}, licence ${k.licence}\n    ${k.kcemu}\n    ${url}\n`);
}

await writeFile(
  join(CIL, 'PUVOD.txt'),
  `Knihovny třetích stran použité pro export obrázku a PDF.
Stahuje je scripts/stahnout-knihovny.mjs, ručně se needitují.

${radky.join('\n')}`
);

console.log('\nPUVOD.txt zapsán.');
