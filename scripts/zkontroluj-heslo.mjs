/*
  Ověří, jestli heslo odpovídá otisku – jen u tebe na počítači.

  K čemu to je: když se nejde přihlásit, člověk neví, jestli je špatně
  heslo, nebo otisk nastavený v Cloudflare. Zkoušet to na webu je drahé –
  po pěti špatných pokusech se přihlašování na 15 minut zavře. Tenhle
  skript nic nikam neposílá a nic neukládá, takže se dá zkoušet donekonečna.

  Spuštění:
      node scripts/zkontroluj-heslo.mjs

  Zeptá se na otisk (ten řetězec pbkdf2$…, klidně ho vlož ze schránky)
  a na heslo. Pak řekne, jestli k sobě patří.

  Otisk, který máš v Cloudflare, zpátky přečíst nejde – ani ty, ani nikdo
  jiný. Vezmi tedy ten, který ti vypsal `node scripts/hash-hesla.mjs`.
  Jestli ho nemáš, vyrob rovnou nový a nastav ho znovu; postup je
  v NASAZENI.md v části „Zapomenuté heslo do administrace“.
*/

import { createInterface } from 'node:readline';
import { overHeslo } from '../lib/auth.js';

/*
  V terminálu se ptáme postupně a psané heslo schováváme. Jedno readline
  pro obě otázky – kdybychom pro každou zakládali vlastní, to druhé by
  přišlo o text, který už čeká ve frontě.

  Když vstup není terminál (třeba při zkoušení skriptu přesměrováním ze
  souboru), readline by si všechny řádky přečetl dřív, než si o ně
  stihneme říct, a druhá otázka by čekala donekonečna. V takovém případě
  si tedy vstup načteme celý dopředu a otázky obsloužíme z něj.
*/
const vTerminalu = Boolean(process.stdin.isTTY);

let rl = null;
let vypis = null;
let radky = null;

if (vTerminalu) {
  rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  vypis = rl._writeToOutput.bind(rl);
} else {
  process.stdin.setEncoding('utf8');
  let vse = '';
  for await (const kus of process.stdin) vse += kus;
  radky = vse.split(/\r?\n/);
}

function zeptejSe(otazka, skryte) {
  if (!vTerminalu) {
    const odpoved = radky.shift() ?? '';
    console.log(otazka + (skryte ? '' : odpoved));
    return Promise.resolve(odpoved);
  }
  return new Promise((hotovo) => {
    rl._writeToOutput = skryte ? () => {} : vypis;
    rl.question(otazka, (odpoved) => {
      if (skryte) process.stdout.write('\n');
      hotovo(odpoved);
    });
  });
}

/* ------------------------------  běh  ------------------------------ */

const UKAZKA = 'pbkdf2$25000$rlMAT8iLwWnesburqnAsww==$lXv0lDp0/Hpj7rOlNhEeI0r9Lbfz8oVApfV9oZki6fU=';

/* Vysvětlí, co je špatně, a skončí. */
function nenasel(duvod, rada) {
  console.error(`\n✗ ${duvod}`);
  if (rada) console.error(`\n${rada}`);
  console.error('\nSkutečný otisk má kolem 70 znaků a vypadá takhle:');
  console.error(`   ${UKAZKA}`);
  console.error('\nVypsal ti ho "node scripts/hash-hesla.mjs". Jestli ho nemáš,');
  console.error('pusť ten skript znovu – vyrobí nový.');
  process.exit(1);
}

const otisk = (await zeptejSe('Otisk (celý řetězec, cca 70 znaků): ', false)).trim();

if (!otisk.startsWith('pbkdf2$')) {
  nenasel('Tohle není otisk – má začínat "pbkdf2$".',
    'Pozor taky na mezeru na začátku, když otisk vkládáš ze schránky.');
}

const casti = otisk.split('$');
if (casti.length !== 4) {
  nenasel(`Otisk má mít čtyři části oddělené znakem $, ale má jich ${casti.length}.`,
    'Nejspíš se při kopírování nepřenesl celý.');
}

/*
  Tady se chytá nejčastější omyl: člověk vloží ukázku tvaru i s výpustkou
  "pbkdf2$25000$…$…" místo skutečného otisku. Tvarem to projde – čtyři
  části, číslo uprostřed – a pak se jen záhadně nedaří přihlásit.
  Sůl i otisk jsou base64, takže musí být dost dlouhé a složené
  z písmen, číslic, + / a = na konci.
*/
const JE_BASE64 = /^[A-Za-z0-9+/]{16,}={0,2}$/;
if (!JE_BASE64.test(casti[2]) || !JE_BASE64.test(casti[3])) {
  nenasel('Za číslem opakování nejsou skutečná data, jen zástupný text.',
    'Výpustka "…" v ukázce znamená "sem patří dlouhý řetězec písmen\na číslic" – nevkládá se, nahrazuje se.');
}

const opakovani = Number(casti[1]);
if (!Number.isInteger(opakovani) || opakovani < 1000) {
  nenasel(`Počet opakování "${casti[1]}" nedává smysl, čekám číslo aspoň 1000.`);
}

console.log(`Otisk vypadá v pořádku: ${opakovani} opakování, ${otisk.length} znaků.`);

const heslo = await zeptejSe('Heslo (nevypisuje se): ', true);
if (rl) rl.close();

if (await overHeslo(heslo, otisk)) {
  console.log('\n✓ ANO – heslo k tomuhle otisku patří.');
  console.log('\nKdyž se s ním přesto nejde přihlásit, není problém v hesle,');
  console.log('ale v tom, že v Cloudflare je nastavený jiný otisk, nebo po');
  console.log('jeho změně neproběhlo nové nasazení. Viz NASAZENI.md, krok 9.');
} else {
  console.log('\n✗ NE – heslo k tomuhle otisku nepatří.');
  console.log('\nZkus to znovu, překlep se snadno stane. Když si heslo');
  console.log('nevybavíš, vyrob nový otisk a nastav ho:');
  console.log('   node scripts/hash-hesla.mjs');
  console.log('   npx wrangler pages secret put ADMIN_HESLO_HASH --project-name ugustiku-web');
  console.log('A pak nezapomeň na nové nasazení, jinak poběží dál to staré.');
  process.exit(1);
}
