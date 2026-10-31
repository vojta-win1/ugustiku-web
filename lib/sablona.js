/*
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
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${d.titulek}</title>
<meta name="description" content="Rodinná restaurace U Gustíků v Řehenicích. Poctivá česká kuchyně, týdenní jídelní lístek a polední menu za 199 Kč.">
<link rel="stylesheet" href="/styl.css">
</head>
<body>



<section class="hero" id="top" aria-label="Úvod">
  <img class="slide on" src="/obrazky/babovka.jpg" alt="Domácí bábovka" style="object-position:center 62%">
  <img class="slide" src="/obrazky/sekana.jpg" alt="Housky se sekanou a cibulkou" style="object-position:center 60%">
  <img class="slide" src="/obrazky/bagety.jpg" alt="Bagety se šunkou, sýrem a zeleninou" style="object-position:center 52%">
  <div class="shade" aria-hidden="true"></div>

  <header class="layer"><div class="wrap top">
    <a class="brand" href="#top">
      <svg width="46" height="46" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="lgHead" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2747B5"/><stop offset="1" stop-color="#C8336F"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#FFFFFF"/><path d="M18 22 V44 A32 32 0 0 0 82 44 V22" fill="none" stroke="url(#lgHead)" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="50" r="21" fill="none" stroke="#2747B5" stroke-width="7"/><circle cx="50" cy="50" r="12" fill="#C8336F"/><path d="M44 46 A7 7 0 0 1 51 41" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>
      <span>U Gustíků</span>
    </a>
    <nav class="nav" aria-label="Hlavní menu">
      <a href="#listek">Lístek</a>
      <a href="#kontakt">Kontakt</a>
      <a class="call" href="tel:+420776107716">Zavolat</a>
    </nav>
  </div></header>

  <div class="layer wrap heroin">
    <span class="kicker in d1">Rodinná restaurace · Řehenice</span>
    <h1 class="display in d2">Poctivá česká kuchyně, každý den jinak.</h1>
    <div class="pill in d3"><span>Polední menu · polévka + hlavní chod + limo</span><b>199 Kč</b></div>
    <a class="btn-light in d4" href="#listek">Lístek na tento týden</a>
  </div>

  <div class="layer wrap herofoot">
    <div class="facts">
      <span>U Gustíků<br>Kříváček 17<br>251 67 Řehenice<br>+420 776 107 716</span>
      <span><strong>Po–Pá</strong>&nbsp; 6:00–14:00<br><strong>So–Ne</strong>&nbsp; zavřeno</span>
    </div>
    <div class="dots">
      <span class="cap" id="cap" aria-live="polite">Domácí bábovka</span>
      <div class="bars" id="bars"></div>
    </div>
  </div>
  <div class="cue" aria-hidden="true"><span></span></div>
</section>

<section class="wrap today" aria-labelledby="today-h">
  <div class="card reveal">
    ${d.karta}
    <a class="more" href="#listek">Celý týden →</a>
  </div>
</section>

<section class="wrap about" aria-label="O nás">
  <span class="rule" aria-hidden="true"></span>
  <p class="reveal">Vaříme poctivě a po česku. Každý všední den čerstvá polévka, výběr hlavních jídel a vždycky i jedno bez masa. Ve vitríně čekají bagety, domácí buchty a zákusky.</p>
</section>

<section class="wrap pair" aria-label="Fotky">
  <figure class="reveal"><img src="/obrazky/babovka.jpg" alt="Domácí bábovka pocukrovaná moučkovým cukrem" loading="lazy"><figcaption>Domácí bábovka z naší vitríny</figcaption></figure>
  <figure class="reveal"><img src="/obrazky/bagety.jpg" alt="Bagety se šunkou, sýrem, rajčetem a polníčkem" loading="lazy"><figcaption>Bagety do ruky – i s sebou</figcaption></figure>
</section>

${d.listek}

<section class="strip" aria-label="Sekaná v housce">
  <img src="/obrazky/sekana.jpg" alt="Housky se sekanou a cibulkou" loading="lazy">
  <div class="shade" aria-hidden="true"></div>
  <p class="reveal">Od nás s plným pupíkem.</p>
</section>

<section class="wrap services" id="sluzby" aria-labelledby="svc-h">
  <h2 class="display reveal" id="svc-h">Co u nás najdete</h2>
  <div class="svc">
    <div class="reveal"><span class="ic"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h24v12H4z"/><path d="M4 27h24"/><path d="M9 18a3 3 0 0 1 6 0"/><path d="M18 18h6"/><path d="M4 15h24"/></svg></span><h3>Bufet</h3><p>Bagety, domácí buchty a zákusky rovnou z vitríny.</p></div>
    <div class="reveal"><span class="ic"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21h24"/><path d="M6 21a10 10 0 0 1 20 0"/><path d="M16 9V7"/><path d="M8 25h16"/></svg></span><h3>Catering</h3><p>Jídlo na oslavy, firemní akce i rodinná setkání. Stačí zavolat a domluvit se.</p></div>
    <div class="reveal"><span class="ic"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a12 9 0 0 1 24 0z"/><path d="M16 14v14"/><path d="M11 28h10"/></svg></span><h3>Venkovní posezení</h3><p>Za hezkého počasí si oběd dáte venku pod slunečníkem.</p></div>
    <div class="reveal"><span class="ic"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11h18l-1.5 17h-15z"/><path d="M12 11V9a4 4 0 0 1 8 0v2"/></svg></span><h3>Jídlo s sebou</h3><p>Menu vám zabalíme s sebou. Hotová jídla najdete i v lednici – platba přes QR kód.</p></div>
  </div>
</section>

<section class="contact" id="kontakt" aria-labelledby="kontakt-h">
  <div class="wrap">
    <div class="info reveal">
      <h2 class="display" id="kontakt-h">Kde nás najdete</h2>
      <div class="cgrid">
        <div><span class="eyebrow">Adresa</span><span class="v">Kříváček 17<br>251 67 Řehenice</span></div>
        <div><span class="eyebrow">Telefon a e-mail</span><span class="v"><a href="tel:+420776107716">+420 776 107 716</a></span><span class="v"><a href="mailto:klenhova@ugustiku.cz">klenhova@ugustiku.cz</a></span></div>
        <div><span class="eyebrow">Otevírací doba</span><span class="v" style="font-weight:400;font-size:17px"><strong>Po–Pá</strong>&nbsp; 6:00–14:00<br><strong>So–Ne</strong>&nbsp; zavřeno</span><span class="s">Svátky a omezený provoz vždy uvidíte u lístku.</span></div>
        <div><span class="eyebrow">Platba</span><span class="v" style="font-weight:400;font-size:17px">Hotově, kartou, bezkontaktně, Apple Pay i QR kódem</span></div>
      </div>
      <a class="ig" href="https://www.instagram.com/u_gustiku/"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>Sledujte nás @u_gustiku</a>
    </div>
    <a class="map reveal" href="https://mapy.com/zakladni?q=K%C5%99%C3%ADv%C3%A1%C4%8Dek%2017%2C%20%C5%98ehenice" target="_blank" rel="noopener">
      <svg width="40" height="40" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 29s-9-8.5-9-15a9 9 0 0 1 18 0c0 6.5-9 15-9 15z"/><circle cx="16" cy="14" r="3.5"/></svg>
      <strong>Kříváček 17, Řehenice</strong>
      <span style="font-size:14px">Otevřít v Mapy.com →</span>
    </a>
  </div>
</section>

<footer>
  <div class="pay">
    <span class="eyebrow">Zaplatíte u nás</span>
    <div class="marquee"><div class="mtrack">
      <ul aria-label="Způsoby platby"><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5"/><path d="M18 9.5v5"/></svg>Hotově</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>Platební karta</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8.5a5 5 0 0 1 0 7"/><path d="M11 6a8.5 8.5 0 0 1 0 12"/><path d="M15 3.5a12 12 0 0 1 0 17"/></svg>Bezkontaktně</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>Visa</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>Mastercard</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg>Apple Pay</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3"/><path d="M21 14v.01"/><path d="M17 21h4v-4"/><path d="M14 18v3"/></svg>QR platba</li></ul>
      <ul class="dup" aria-hidden="true"><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5"/><path d="M18 9.5v5"/></svg>Hotově</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>Platební karta</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8.5a5 5 0 0 1 0 7"/><path d="M11 6a8.5 8.5 0 0 1 0 12"/><path d="M15 3.5a12 12 0 0 1 0 17"/></svg>Bezkontaktně</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>Visa</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>Mastercard</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg>Apple Pay</li><li class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3"/><path d="M21 14v.01"/><path d="M17 21h4v-4"/><path d="M14 18v3"/></svg>QR platba</li></ul>
    </div></div>
  </div>
  <div class="wrap fmain">
    <div class="logo reveal">
      <svg class="ring" width="156" height="156" viewBox="0 0 156 156" aria-hidden="true"><circle cx="78" cy="78" r="74" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-dasharray="2 9" stroke-linecap="round"/></svg>
      <svg width="124" height="124" viewBox="0 0 100 100" role="img" aria-label="Logo U Gustíků"><defs><linearGradient id="lgFoot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2747B5"/><stop offset="1" stop-color="#C8336F"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#FFFFFF"/><path d="M18 22 V44 A32 32 0 0 0 82 44 V22" fill="none" stroke="url(#lgFoot)" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="50" r="21" fill="none" stroke="#2747B5" stroke-width="7"/><circle cx="50" cy="50" r="12" fill="#C8336F"/><path d="M44 46 A7 7 0 0 1 51 41" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>
    </div>
    <span class="fname reveal">U Gustíků</span>
    <span class="fslogan reveal">Od nás s plným pupíkem.</span>
    <nav class="fnav" aria-label="Patička">
      <a class="flink" href="#listek">Týdenní lístek</a>
      <a class="flink" href="#sluzby">Služby</a>
      <a class="flink" href="#kontakt">Kontakt</a>
      <a class="flink" href="https://www.instagram.com/u_gustiku/">Instagram</a>
    </nav>
    <span class="faddr">Kříváček 17, Řehenice · +420 776 107 716</span>
  </div>
  <div class="wrap fbar">
    <span>© 2026 U Gustíků, Řehenice</span>
    <a class="flink" href="/admin">Přihlášení pro správce</a>
  </div>
  <div class="giant" aria-hidden="true">U Gustíků</div>
</footer>

<script src="/web.js" defer></script>

</body>
</html>`;
}
