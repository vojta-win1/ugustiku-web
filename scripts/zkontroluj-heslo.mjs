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

const otisk = (await zeptejSe('Otisk (pbkdf2$…): ', false)).trim();

if (!otisk.startsWith('pbkdf2$')) {
  console.error('\nTohle není otisk. Má začínat "pbkdf2$" a vypadat takhle:');
  console.error('   pbkdf2$25000$dlouhýřetězec$dlouhýřetězec\n');
  console.error('Pozor, ať tam z kopírování nezůstala mezera na začátku –');
  console.error('to je jediná podoba nepořádku, kterou ověřování nepřežije.');
  process.exit(1);
}

const casti = otisk.split('$');
if (casti.length !== 4) {
  console.error(`\nOtisk má mít čtyři části oddělené znakem $, ale má jich ${casti.length}.`);
  console.error('Nejspíš se při kopírování nepřenesl celý.');
  process.exit(1);
}
console.log(`Otisk vypadá v pořádku: ${casti[1]} opakování.`);

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
