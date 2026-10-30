/*
  Výběr dne a vykreslení lístku do HTML.

  Všechno se děje na serveru. Do stránky se pokaždé vypíše všech pět dnů
  a JavaScript v prohlížeči pak jen schovává ty neaktivní. Dva důvody:

   1) Google (a náhled odkazu na Facebooku, ve zprávách…) vidí celý lístek
      rovnou v HTML, nemusí spouštět JavaScript.
   2) Kdo má JavaScript vypnutý, uvidí celý týden pod sebou a záložky mu
      fungují jako obyčejné odkazy. Nic se nerozbije.
*/

import {
  NAZVY_DNU,
  ZKRATKY_DNU,
  denVTydnu,
  dnesVPraze,
  kratkeDatum,
  popisDne,
  pondeliTydne,
  posunDnu,
  rozsahTydne,
} from './datum.js';
import { nactiZverejnenyTyden } from './db.js';

export const ALERGENY = [
  'Obiloviny s lepkem',
  'Korýši',
  'Vejce',
  'Ryby',
  'Arašídy',
  'Sója',
  'Mléko',
  'Skořápkové plody',
  'Celer',
  'Hořčice',
  'Sezam',
  'Oxid siřičitý a siřičitany',
  'Vlčí bob',
  'Měkkýši',
];

export const INSTAGRAM = 'https://www.instagram.com/u_gustiku/';

/** Zkratky v adrese: /?den=ut */
const KODY_DNU = ['po', 'ut', 'st', 'ct', 'pa'];

/** Ošetření textu, než se vloží do HTML. Bez tohohle by šlo do stránky propašovat cizí kód. */
export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const maJidla = (den) => den.jidla.length > 0;
const jeOtevreno = (den) => !den.zavreno && maJidla(den);

/**
 * Rozhodne, co se návštěvníkovi ukáže.
 *
 * Pravidla:
 *   – Po–Pá: dnešek. So–Ne: rovnou pondělí příštího týdne.
 *   – Je-li ten den zavřený (nebo prázdný), posuneme se na nejbližší
 *     další otevřený den, klidně i do příštího týdne.
 *   – Není-li potřebný týden zveřejněný, vrátíme stav 'nezverejneno'.
 *   – Parametr ?den= v adrese má přednost (uživatel si listuje sám).
 *
 * Kvůli počtu čtení z databáze se díváme nejvýš na dva týdny.
 */
export async function vyberZobrazeni(db, { den = null, celyTyden = false, ted = new Date() } = {}) {
  const dnes = dnesVPraze(ted);
  const dnesniDen = denVTydnu(dnes); // 1 = pondělí … 7 = neděle
  const jeVikend = dnesniDen > 5;

  // O víkendu je nejbližší provoz až v pondělí příštího týdne.
  const pondeli = jeVikend ? posunDnu(pondeliTydne(dnes), 7) : pondeliTydne(dnes);
  const vychoziIndex = jeVikend ? 0 : dnesniDen - 1;

  let tyden = await nactiZverejnenyTyden(db, pondeli);
  if (!tyden) {
    return { stav: 'nezverejneno', pondeli, jePristiTyden: jeVikend, dnes };
  }

  // Najdi nejbližší otevřený den od výchozího dál.
  let zobrazenyPondeli = pondeli;
  let autoIndex = vychoziIndex;
  while (autoIndex < 5 && !jeOtevreno(tyden.dny[autoIndex])) autoIndex++;

  let jeDnesek = !jeVikend && autoIndex === vychoziIndex;

  if (autoIndex === 5) {
    // Do konce týdne už nic otevřeného není – zkus příští týden.
    const dalsiPondeli = posunDnu(pondeli, 7);
    const dalsi = await nactiZverejnenyTyden(db, dalsiPondeli);
    let i = 0;
    if (dalsi) {
      while (i < 5 && !jeOtevreno(dalsi.dny[i])) i++;
    }
    if (dalsi && i < 5) {
      tyden = dalsi;
      zobrazenyPondeli = dalsiPondeli;
      autoIndex = i;
    } else {
      // Nic otevřeného nikde – ukážeme aspoň poslední den s jeho poznámkou.
      autoIndex = 4;
    }
    jeDnesek = false;
  }

  /*
    `index` je den, který si návštěvník zrovna prohlíží (může si ho přepnout
    odkazem ?den=). `autoIndex` zůstává dnešek, respektive nejbližší otevřený
    den – podle něj se řídí karta v úvodu stránky. Kdyby se karta měnila
    s listováním, přestalo by platit, že ukazuje, co je dnes na talíři.
  */
  const zvoleny = KODY_DNU.indexOf(den);
  const index = zvoleny === -1 ? autoIndex : zvoleny;

  return { stav: 'ok', tyden, pondeli: zobrazenyPondeli, index, autoIndex, celyTyden, dnes, jeDnesek };
}

/* ----------------------------  vykreslení  ---------------------------- */

function jidloHtml(jidlo, poradi) {
  const typ = jidlo.typ === 'polevka' ? 'Polévka' : 'Hlavní chod';
  const bezMasa = jidlo.bezMasa ? ' <span class="veg">Bez masa</span>' : '';
  const alergeny = jidlo.alergeny.length
    ? `<span class="alg">Alergeny: ${esc(jidlo.alergeny.join(', '))}</span>`
    : '';
  return (
    `<div class="dish" style="animation-delay:${poradi * 60}ms">` +
    `<div class="txt">` +
    `<span class="kind">${typ}</span>` +
    `<span class="nm">${esc(jidlo.nazev)}${bezMasa}</span>` +
    alergeny +
    `</div>` +
    `<span class="pr">${esc(jidlo.cena)} Kč</span>` +
    `</div>`
  );
}

function denHtml(den, index, pondeli, aktivni) {
  let obsah;
  if (den.zavreno) {
    obsah =
      `<div class="zavreno">` +
      `<strong>Zavřeno</strong>` +
      (den.poznamka ? `<span>${esc(den.poznamka)}</span>` : '') +
      `</div>`;
  } else if (!maJidla(den)) {
    obsah = `<div class="zavreno"><strong>Zatím nevyplněno</strong><span>Menu na tento den ještě doplňujeme.</span></div>`;
  } else {
    obsah = den.jidla.map(jidloHtml).join('');
  }

  return (
    `<section class="den${aktivni ? ' aktivni' : ''}" id="den-${KODY_DNU[index]}" data-den="${index}" aria-label="${esc(popisDne(pondeli, index))}">` +
    `<h3 class="dennazev display">${esc(NAZVY_DNU[index])} <small>${esc(kratkeDatum(posunDnu(pondeli, index)))}</small></h3>` +
    obsah +
    `</section>`
  );
}

/*
  Šipka je vždycky <a>, i když se s ní zrovna nedá nikam jít – nedostupná
  jen nemá href a má aria-disabled. Díky tomu si JavaScript při přepínání
  dnů jen přepíše odkaz a nemusí prvky v stránce vyměňovat.
*/
function sipka(smer, cilovyIndex, dostupna) {
  const popis = smer === 'zpet' ? 'Předchozí den' : 'Další den';
  const znak = smer === 'zpet' ? '‹' : '›';
  const odkaz = dostupna
    ? ` href="?den=${KODY_DNU[cilovyIndex]}#listek" rel="${smer === 'zpet' ? 'prev' : 'next'}"`
    : ' aria-disabled="true"';
  return `<a class="sipka" data-sipka="${smer}" aria-label="${popis}"${odkaz}>${znak}</a>`;
}

function legendaHtml() {
  return ALERGENY.map((a, i) => `<li><b>${i + 1}</b> ${esc(a)}</li>`).join('');
}

/** Hláška, když týden ještě není venku – nebo když se databáze neozvala. */
function nezverejnenoHtml(stav) {
  const ktery = stav.jePristiTyden ? 'na příští týden' : 'na tento týden';
  const [nadpis, text] =
    stav.stav === 'chyba'
      ? ['Lístek se teď nepodařilo načíst.', 'Zkuste to prosím za chvíli znovu. Mezitím ho najdete na Instagramu.']
      : [
          `Lístek ${ktery} zatím nemáme zveřejněný.`,
          'Jakmile bude hotový, objeví se tady. Nejčerstvější novinky dáváme vždycky na Instagram.',
        ];
  return (
    `<div class="nezverejneno">` +
    `<strong>${nadpis}</strong>` +
    `<p>${text}</p>` +
    `<a class="ig" href="${INSTAGRAM}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>Sledujte nás @u_gustiku</a>` +
    `</div>`
  );
}

/** Celá sekce „Jídelní lístek“. */
export function listekHtml(stav) {
  const hlavicka = (nadpis) =>
    `<div class="menuhead reveal">` +
    `<div style="display:flex;flex-direction:column;gap:6px">` +
    `<span class="eyebrow r">Jídelní lístek</span>` +
    `<h2 class="display" id="menu-h">${esc(nadpis)}</h2>` +
    `</div>` +
    `<span class="note">Menu za <strong>199 Kč</strong> = polévka + hlavní chod + limo</span>` +
    `</div>`;

  if (stav.stav !== 'ok') {
    return (
      `<section class="menu" id="listek" aria-labelledby="menu-h"><div class="wrap narrow">` +
      hlavicka(`Týden ${rozsahTydne(stav.pondeli)}`) +
      nezverejnenoHtml(stav) +
      `</div></section>`
    );
  }

  const { tyden, pondeli, index, celyTyden } = stav;

  /*
    Záložka nese název dne nadvakrát: plně i jako zkratku. Na širokém
    displeji se ukazuje „Pondělí 26. 10.“, na mobilu jen „Po“ – jinak by se
    pět záložek zlomilo do dvou řádků. Celý název s datem je stejně hned
    pod záložkami v nadpisu dne.
  */
  const zalozky = NAZVY_DNU.map(
    (nazev, i) =>
      `<a class="tab" href="?den=${KODY_DNU[i]}#listek" id="zalozka-${KODY_DNU[i]}" data-den="${i}"` +
      (i === index && !celyTyden ? ' aria-current="page"' : '') +
      ` aria-label="${esc(nazev)} ${esc(kratkeDatum(posunDnu(pondeli, i)))}">` +
      `<span class="plny" aria-hidden="true">${esc(nazev)}</span>` +
      `<span class="zkratka" aria-hidden="true">${esc(ZKRATKY_DNU[i])}</span>` +
      `<small aria-hidden="true">${esc(kratkeDatum(posunDnu(pondeli, i)))}</small></a>`
  ).join('');

  /*
    Šipky a záložky se vypisují vždycky, v režimu celého týdne jsou jen
    schované. Kdyby v HTML vůbec nebyly, neměl by je JavaScript co zpátky
    ukázat, až se návštěvník přepne na jeden den.
  */
  const ovladani =
    `<div class="denpres" id="denpres"${celyTyden ? ' hidden' : ''}>` +
    sipka('zpet', index - 1, index > 0) +
    `<nav class="tabs" aria-label="Dny v týdnu" id="tabs">${zalozky}</nav>` +
    sipka('vpred', index + 1, index < 4) +
    `</div>`;

  const dny = tyden.dny.map((den, i) => denHtml(den, i, pondeli, i === index)).join('');

  const prepinac = celyTyden
    ? `<a class="prepinac" id="prepinac" href="?den=${KODY_DNU[index]}#listek" data-rezim="jeden">Zobrazit jeden den</a>`
    : `<a class="prepinac" id="prepinac" href="?tyden=cely#listek" data-rezim="cely">Celý týden</a>`;

  return (
    `<section class="menu" id="listek" aria-labelledby="menu-h"><div class="wrap narrow">` +
    hlavicka(`Týden ${rozsahTydne(pondeli)}`) +
    ovladani +
    `<div id="dny"${celyTyden ? '' : ' class="jeden"'}>${dny}</div>` +
    `<div class="podlistkem">` +
    prepinac +
    `<button class="algbtn" type="button" id="algbtn" aria-expanded="false" aria-controls="alglist">Co znamenají čísla alergenů?</button>` +
    `</div>` +
    `<ul class="alglist" id="alglist" hidden>${legendaHtml()}</ul>` +
    `</div></section>`
  );
}

/** Karta „Dnes na talíři“ v úvodu stránky. */
export function kartaHtml(stav) {
  if (stav.stav !== 'ok') {
    const text =
      stav.stav === 'chyba'
        ? 'Lístek se teď nepodařilo načíst, zkuste to prosím za chvíli.'
        : `Lístek ${stav.jePristiTyden ? 'na příští týden' : 'na tento týden'} zatím nemáme zveřejněný.`;
    return (
      `<div class="cardhead"><h2 class="display" id="today-h">Jídelní lístek</h2></div>` +
      `<p style="margin:6px 0 0;color:var(--ink-2)">${text} Najdete nás na Instagramu <a href="${INSTAGRAM}">@u_gustiku</a>.</p>`
    );
  }

  // Karta ukazuje dnešek (autoIndex), ne ten den, který si návštěvník listuje.
  const den = stav.tyden.dny[stav.autoIndex];
  const nadpis = stav.jeDnesek ? 'Dnes na talíři' : 'Nejbližší menu';
  const hlavicka =
    `<div class="cardhead"><h2 class="display" id="today-h">${nadpis}</h2>` +
    `<span id="today-d">${esc(popisDne(stav.pondeli, stav.autoIndex))}</span></div>`;

  if (den.zavreno || !maJidla(den)) {
    const text = den.zavreno ? den.poznamka || 'Zavřeno' : 'Menu na tento den ještě doplňujeme.';
    return hlavicka + `<p style="margin:6px 0 0;color:var(--ink-2)">${esc(text)}</p>`;
  }

  const radky = den.jidla
    .map(
      (j) =>
        `<div class="row"><span class="name">${esc(j.nazev)}` +
        (j.bezMasa ? ' <span class="veg">Bez masa</span>' : '') +
        `</span><span class="price">${esc(j.cena)} Kč</span></div>`
    )
    .join('');

  return hlavicka + `<div id="today-list">${radky}</div>`;
}

/** Titulek stránky – ať je v Googlu a v záložkách vidět, co je k obědu. */
export function titulekStranky(stav) {
  if (stav.stav !== 'ok') return 'U Gustíků – rodinná restaurace v Rehenicích';
  return `Polední menu – ${popisDne(stav.pondeli, stav.index)} | U Gustíků, Rehenice`;
}

export { KODY_DNU, ZKRATKY_DNU };
