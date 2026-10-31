/*
  Vyrobí z hesla otisk (hash), který se uloží do Cloudflare jako secret.

  Samotné heslo nikde neukládáme – ani v kódu, ani v databázi. Ukládá se
  jen otisk, ze kterého se heslo zpátky spočítat nedá. Při přihlášení se
  zadané heslo přepočítá stejným způsobem a porovnají se otisky.

  Spuštění:
      node scripts/hash-hesla.mjs              – zeptá se na heslo
      node scripts/hash-hesla.mjs --navrhni    – navrhne silné heslo

  Výsledek vypadá takhle:
      pbkdf2$25000$sůl$otisk

  ------------------------------------------------------------------
  PROČ 25 000 OPAKOVÁNÍ A NE VÍC

  Opakování PBKDF2 schválně zdržují, aby se heslo nedalo rychle hádat.
  Čím víc, tím líp – jenže bezplatný tarif Cloudflare dává každému
  požadavku jen 10 ms procesorového času a 100 000 opakování zabere
  kolem 14 ms. Přihlášení by skončilo chybou.

  Proto 25 000 (asi 4 ms) a chybějící bezpečnost doháníme délkou hesla:
  krátké heslo tenhle skript nepřijme. Navíc platí, že po pěti špatných
  pokusech se přihlašování na 15 minut zavře, takže hádat heslo přes web
  nejde. Otisk by musel někdo nejdřív ukrást přímo z účtu Cloudflare.

  Kdybys někdy přešel na placený tarif, zvyš OPAKOVANI níž a pusť skript
  znovu – počet je součástí uloženého otisku, v kódu se nic měnit nemusí.
  ------------------------------------------------------------------
*/

import { webcrypto as crypto } from 'node:crypto';
import { createInterface } from 'node:readline';

const OPAKOVANI = 25000;
const NEJKRATSI_HESLO = 12;

/* Slova pro návrh hesla: krátká, česká, jednoznačně se píšou a dobře se
   ťukají na mobilu. Pět slov z téhle stovky dá přes miliardu miliard
   kombinací – na hádání přes přihlašovací stránku zdaleka dost. */
const SLOVA = `bota brána buk cesta cibule čaj člun dort dub duha dveře hora houba hrad hrnek
jablko jahoda jelen ježek kámen kapr klíč kniha kolo komín koš kotva kovář krab kruh křeslo
květ labuť lampa les lípa liška loď louka lžíce medvěd meloun město most motýl mrak myš nebe
noha nůž oblak oheň okno ořech ovce palec pavouk pecka pero pes píseň plot pole potok prsten
pták rak ryba rýč sad sklo slunce sova stůl strom svíčka šála šíp štít tulipán tužka ulice
váza včela velryba věž vítr voda vlak vlk vrba zahrada zámek zvon žába žebřík židle`
  .split(/\s+/)
  .filter(Boolean);

const b64 = (bajty) => Buffer.from(bajty).toString('base64');

async function spoctiOtisk(heslo, sul, opakovani) {
  const klic = await crypto.subtle.importKey('raw', new TextEncoder().encode(heslo), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bity = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sul, iterations: opakovani },
    klic,
    256
  );
  return new Uint8Array(bity);
}

function navrhniHeslo() {
  const vybrana = [];
  // getRandomValues, ne Math.random – ten je předvídatelný a na hesla se nehodí.
  const cisla = crypto.getRandomValues(new Uint32Array(5));
  for (const n of cisla) vybrana.push(SLOVA[n % SLOVA.length]);
  return vybrana.join('-');
}

/*
  Zeptá se na heslo, ale psané znaky nevypisuje na obrazovku.
  Pořadí je důležité: nejdřív se položí otázka (ta se vypsat má)
  a teprve pak se vypisování vypne.

  Skript potřebuje opravdový terminál – přes rouru (echo … | node …)
  nefunguje, a to schválně: heslo by zůstalo v historii příkazů.
*/
function zeptejSeNaHeslo(otazka) {
  return new Promise((hotovo) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(otazka, (odpoved) => {
      rl.close();
      process.stdout.write('\n');
      hotovo(odpoved);
    });
    rl._writeToOutput = () => {};
  });
}

/* ------------------------------  běh  ------------------------------ */

if (process.argv.includes('--navrhni')) {
  console.log('\nNávrh hesla:\n');
  console.log('    ' + navrhniHeslo() + '\n');
  console.log('Ulož si ho do správce hesel v telefonu a pusť skript znovu bez --navrhni.\n');
  process.exit(0);
}

const heslo = await zeptejSeNaHeslo('Zadej heslo pro administraci: ');

if (heslo.length < NEJKRATSI_HESLO) {
  console.error(`\nHeslo musí mít aspoň ${NEJKRATSI_HESLO} znaků, tohle má ${heslo.length}.`);
  console.error('Nápad na silné a dobře zapamatovatelné heslo dostaneš příkazem:');
  console.error('    node scripts/hash-hesla.mjs --navrhni\n');
  process.exit(1);
}

const znovu = await zeptejSeNaHeslo('Zadej heslo ještě jednou:    ');
if (heslo !== znovu) {
  console.error('\nHesla se neshodují, zkus to prosím znovu.\n');
  process.exit(1);
}

const sul = crypto.getRandomValues(new Uint8Array(16));
const otisk = await spoctiOtisk(heslo, sul, OPAKOVANI);
const retezec = `pbkdf2$${OPAKOVANI}$${b64(sul)}$${b64(otisk)}`;

console.log('\nHotovo. Tohle je otisk hesla:\n');
console.log('    ' + retezec);
console.log(`
Co s ním dál
------------

1) Pro zkoušení u sebe v počítači:
   Vytvoř v hlavní složce projektu soubor .dev.vars (je v .gitignore,
   do gitu se nedostane) a dej do něj jediný řádek:

       ADMIN_HESLO_HASH="${retezec}"

2) Pro ostrý web (až ve fázi 4, po založení projektu na Cloudflare):

       npx wrangler pages secret put ADMIN_HESLO_HASH

   Příkaz se zeptá na hodnotu – vlož ten řetězec výše.

Změna hesla kdykoli později = pustit tenhle skript znovu a nahradit
hodnotu na obou místech. V kódu se nic měnit nemusí.

Samotné heslo nikam nezapisuj. Otisk v .dev.vars ani v Cloudflare
nikomu neposílej.
`);
