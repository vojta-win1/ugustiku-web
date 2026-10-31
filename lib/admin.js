/*
  HTML stránek administrace: přihlašovací obrazovka a kostra editoru.

  Kostra je schválně skoro prázdná – vlastní editor si vykreslí
  /admin/admin.js z dat, která jsou ve stránce vložená jako JSON.
  Administrace je za heslem, takže tady na rozdíl od veřejného webu
  nemá smysl řešit vyhledávače ani běh bez JavaScriptu.
*/

import { rozsahTydne } from './datum.js';
import { ALERGENY, esc } from './listek.js';

const HLAVA = (titulek, dalsiStyly = []) => `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulek)} · U Gustíků</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/styl.css">
<link rel="stylesheet" href="/admin/admin.css">
${dalsiStyly.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
</head>`;

const ZNACKA = `<svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="lgA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2747B5"/><stop offset="1" stop-color="#C8336F"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#FFFFFF"/><path d="M18 22 V44 A32 32 0 0 0 82 44 V22" fill="none" stroke="url(#lgA)" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="50" r="21" fill="none" stroke="#2747B5" stroke-width="7"/><circle cx="50" cy="50" r="12" fill="#C8336F"/><path d="M44 46 A7 7 0 0 1 51 41" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>`;

/* ----------------------  přihlašovací obrazovka  ---------------------- */

const HLASKY = {
  heslo: 'Heslo nesedí. Zkus to prosím znovu.',
  cizi: 'Přihlášení přišlo z cizí stránky, proto jsme ho odmítli.',
  databaze: 'Nepodařilo se spojit s databází. Zkus to prosím za chvíli.',
  nastaveni:
    'Heslo pro administraci zatím není nastavené. Nastavíš ho příkazem <code>node scripts/hash-hesla.mjs</code>.',
};

export function prihlaseniHtml({ chyba = null, minut = 0 } = {}) {
  let hlaska = '';
  if (chyba === 'blokace') {
    hlaska = `Moc špatných pokusů za sebou. Zkus to prosím za ${minut} ${minut === 1 ? 'minutu' : minut < 5 ? 'minuty' : 'minut'}.`;
  } else if (chyba && HLASKY[chyba]) {
    hlaska = HLASKY[chyba];
  }

  return `${HLAVA('Přihlášení')}
<body class="admin prihlaseni">
<main class="prihlbox">
  <div class="prihlznacka">${ZNACKA}<span>U Gustíků</span></div>
  <h1 class="display">Správa jídelního lístku</h1>
  ${hlaska ? `<p class="chyba" role="alert">${hlaska}</p>` : ''}
  <form method="post" action="/api/prihlaseni">
    <label for="heslo">Heslo</label>
    <input type="password" id="heslo" name="heslo" autocomplete="current-password"
           required autofocus enterkeyhint="go">
    <button type="submit" class="atlac hlavni">Přihlásit se</button>
  </form>
  <a class="zpet" href="/">← Zpět na web</a>
</main>
</body>
</html>`;
}

/* -------------------------  kostra editoru  ------------------------- */

/**
 * @param {object} data  týden k úpravě (stejný tvar, jaký vrací nactiTyden)
 * @param {string} predchozi  datum pondělí předchozího týdne
 * @param {string} dalsi      datum pondělí následujícího týdne
 */
export function editorHtml({ data, predchozi, dalsi }) {
  /*
    Data se do stránky vkládají jako JSON. Znak < se nahrazuje, aby
    v textu nemohlo vzniknout </script> a rozbít stránku.

    Posílá se s nimi i seznam alergenů – ať je jen na jednom místě
    (lib/listek.js) a editor ho nemá opsaný podruhé.
  */
  const json = JSON.stringify({ tyden: data, alergeny: ALERGENY }).replace(/</g, '\\u003c');

  return `${HLAVA('Správa lístku', ['/admin/export.css'])}
<body class="admin">

<header class="ahlav">
  <div class="awrap ahlavin">
    <span class="aznacka">${ZNACKA}<span>Správa lístku</span></span>
    <form method="post" action="/api/odhlaseni"><button type="submit" class="atlac tiche">Odhlásit</button></form>
  </div>
</header>

<main class="awrap">

  <section class="atyden">
    <a class="asipka" href="/admin?tyden=${predchozi}" aria-label="Předchozí týden">‹</a>
    <div class="atydeninfo">
      <strong>${esc(rozsahTydne(data.pondeli))}</strong>
      <span id="stav-tydne"></span>
    </div>
    <a class="asipka" href="/admin?tyden=${dalsi}" aria-label="Další týden">›</a>
  </section>

  <section class="apanel">
    <span id="ulozeno" class="ulozeno" aria-live="polite"></span>
    <button type="button" class="atlac" id="kopirovat">Zkopírovat minulý týden</button>
    <button type="button" class="atlac hlavni" id="zverejnit"></button>
  </section>

  <section class="aexport">
    <div class="aexporthlava">
      <strong>Export pro Instagram a tisk</strong>
      <span id="exportstav" class="exportstav" aria-live="polite"></span>
    </div>
    <div class="aexporttlacitka">
      <button type="button" class="atlac" data-export="instagram">Obrázek pro Instagram</button>
      <button type="button" class="atlac" data-export="letak">Leták PDF (A4)</button>
      <button type="button" class="atlac" data-export="story">Menu dne do Stories</button>
    </div>
  </section>

  <div class="aprepinac" role="tablist" aria-label="Zobrazení">
    <button type="button" class="atlac" id="rezim-upravit" aria-pressed="true">Upravit</button>
    <button type="button" class="atlac" id="rezim-nahled" aria-pressed="false">Náhled</button>
  </div>

  <div class="asloupce" id="sloupce" data-rezim="upravit">
    <div class="asloupec-editor">
      <nav class="adny" id="adny" aria-label="Dny v týdnu"></nav>
      <div id="editor"></div>
    </div>
    <aside class="asloupec-nahled">
      <p class="anahledpopis">Takhle lístek uvidí hosté na webu.</p>
      <iframe id="nahled" title="Náhled lístku" src="/admin/nahled/${data.pondeli}?den=po"></iframe>
    </aside>
  </div>

</main>

<script id="data" type="application/json">${json}</script>
<script src="/admin/vendor/html-to-image.js" defer></script>
<script src="/admin/vendor/jspdf.umd.min.js" defer></script>
<script src="/admin/export.js" defer></script>
<script src="/admin/admin.js" defer></script>
</body>
</html>`;
}
