/*
  Export lístku do obrázku a do PDF.

  Všechno se děje v prohlížeči – server se do toho vůbec neplete, takže
  to nic nestojí a funguje to i na telefonu.

  Postup je pokaždé stejný:
    1. Mimo obrazovku se postaví předloha v přesné velikosti (1080×1350…).
    2. Zmenší se jí písmo, dokud se celý lístek nevejde. Nic se neořezává.
    3. Z předlohy se udělá obrázek PNG (knihovna html-to-image).
    4. U letáku se obrázek vloží do stránky A4 (knihovna jsPDF).
    5. Předloha se zase zahodí.

  Data jsou pořád ta samá, která jsou v editoru – nic se nepřepisuje ručně.
*/
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Kontakt do patičky letáku. Musí sedět s tím, co je na webu
     v sekci Kontakt (navrh/index.html) – mění se to na obou místech.
     ------------------------------------------------------------------ */
  var KONTAKT = {
    adresa: 'Kříváček 17, Řehenice',
    telefon: '+420 776 107 716',
    doba: 'Po–Pá 6:00–14:00',
    instagram: '@u_gustiku',
  };

  var NAZVY = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
  var KODY = ['po', 'ut', 'st', 'ct', 'pa'];

  var ZNAK =
    '<svg width="62" height="62" viewBox="0 0 100 100" aria-hidden="true">' +
    '<defs><linearGradient id="lgEx" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#2747B5"/><stop offset="1" stop-color="#C8336F"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="48" fill="#FFFFFF"/>' +
    '<path d="M18 22 V44 A32 32 0 0 0 82 44 V22" fill="none" stroke="url(#lgEx)" stroke-width="7" stroke-linecap="round"/>' +
    '<circle cx="50" cy="50" r="21" fill="none" stroke="#2747B5" stroke-width="7"/>' +
    '<circle cx="50" cy="50" r="12" fill="#C8336F"/>' +
    '<path d="M44 46 A7 7 0 0 1 51 41" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>';

  /*
    Rozměry jsou v pixelech předlohy. `pixely` je zvětšení při převodu na
    obrázek: leták se kreslí dvakrát větší, aby byl na papíře ostrý
    (2160 × 3055 bodů, tedy zhruba 260 DPI).

    Výška letáku vychází z poměru stránky A4: 1080 × 297/210 = 1527.
  */
  var FORMATY = {
    instagram: { sirka: 1080, vyska: 1350, pixely: 1, pata: false, jedenDen: false, trida: '', strop: 1.5 },
    story: { sirka: 1080, vyska: 1920, pixely: 1, pata: false, jedenDen: true, trida: 'story', strop: 1.25 },
    letak: { sirka: 1080, vyska: 1527, pixely: 2, pata: true, jedenDen: false, trida: '', strop: 1.5 },
  };

  /* ---------------------------  stavba předlohy  --------------------------- */

  function e(znacka, trida, text) {
    var p = document.createElement(znacka);
    if (trida) p.className = trida;
    if (text != null) p.textContent = text;
    return p;
  }

  function kratkeDatum(pondeli, posun) {
    var d = new Date(pondeli + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + posun);
    return d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '.';
  }

  function rozsahTydne(pondeli) {
    var a = pondeli.split('-').map(Number);
    var k = new Date(pondeli + 'T12:00:00Z');
    k.setUTCDate(k.getUTCDate() + 4);
    var b = [k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate()];
    if (a[0] !== b[0]) return a[2] + '. ' + a[1] + '. ' + a[0] + ' – ' + b[2] + '. ' + b[1] + '. ' + b[0];
    if (a[1] !== b[1]) return a[2] + '. ' + a[1] + '. – ' + b[2] + '. ' + b[1] + '. ' + b[0];
    return a[2] + '.–' + b[2] + '. ' + b[1] + '. ' + b[0];
  }

  function jidloDoListu(jidlo) {
    var radek = e('div', 'exJidlo');

    var nazev = e('span', 'nazev', jidlo.nazev);
    if (jidlo.bezMasa) {
      var znacka = e('span', 'exBezMasa', 'bez masa');
      nazev.appendChild(znacka);
    }
    radek.appendChild(nazev);
    radek.appendChild(e('span', 'tecky'));
    radek.appendChild(e('span', 'cena', jidlo.cena + ' Kč'));
    return radek;
  }

  function denDoListu(den, index, pondeli, sDatem) {
    var sekce = e('section', 'exDen');
    sekce.appendChild(
      e('h2', 'exDenNazev', sDatem ? NAZVY[index] + ' ' + kratkeDatum(pondeli, index) : NAZVY[index])
    );

    if (den.zavreno) {
      sekce.appendChild(e('p', 'exZavreno', den.poznamka || 'Zavřeno'));
      return sekce;
    }
    if (!den.jidla.length) {
      sekce.appendChild(e('p', 'exPrazdno', 'Menu zatím doplňujeme.'));
      return sekce;
    }

    den.jidla.forEach(function (jidlo) {
      sekce.appendChild(jidloDoListu(jidlo));
      if (jidlo.alergeny.length) {
        sekce.appendChild(e('div', 'exAlg', 'A: ' + jidlo.alergeny.join(', ')));
      }
    });
    return sekce;
  }

  function patickaLetaku(alergeny) {
    // Schválně <div> a ne <footer>: na značku footer míří styl patičky
    // veřejného webu (tmavé pozadí) a propsal by se i sem.
    var pata = e('div', 'exPata');
    pata.appendChild(e('span', 'nadpis', 'Alergeny'));

    var seznam = e('ul', 'exLegenda');
    alergeny.forEach(function (nazev, i) {
      var polozka = e('li');
      var cislo = e('b', null, String(i + 1));
      polozka.appendChild(cislo);
      polozka.appendChild(document.createTextNode(' ' + nazev));
      seznam.appendChild(polozka);
    });
    pata.appendChild(seznam);

    var kontakt = e('div', 'exKontakt');
    var vlevo = e('span');
    vlevo.appendChild(e('strong', null, 'U Gustíků'));
    vlevo.appendChild(document.createTextNode(
      ' · ' + KONTAKT.adresa + ' · ' + KONTAKT.telefon + ' · ' + KONTAKT.doba
    ));
    kontakt.appendChild(vlevo);
    kontakt.appendChild(e('span', null, KONTAKT.instagram));
    pata.appendChild(kontakt);

    return pata;
  }

  function postavPredlohu(typ, stav) {
    var f = FORMATY[typ];

    var schranka = e('div', 'exSchranka');
    schranka.setAttribute('aria-hidden', 'true');

    var list = e('div', 'exList' + (f.trida ? ' ' + f.trida : ''));
    list.style.width = f.sirka + 'px';
    list.style.height = f.vyska + 'px';

    // Kolečko s cenou menu leží v rohu přes volné místo vedle nadpisu,
    // proto se vkládá samostatně a ne do řádku s logem.
    var kolecko = e('div', 'exKolecko');
    kolecko.appendChild(e('span', 'k1', 'MENU'));
    var k2 = e('span', 'k2');
    k2.innerHTML = 'POLÉVKA +<br>HLAVNÍ CHOD + LIMO';
    kolecko.appendChild(k2);
    kolecko.appendChild(e('span', 'k3', '= 199 Kč'));
    list.appendChild(kolecko);

    var znacka = e('div', 'exZnacka');
    var logo = e('div');
    logo.innerHTML = ZNAK;
    znacka.appendChild(logo);
    znacka.appendChild(e('span', 'nazev', 'U GUSTÍKŮ'));
    znacka.appendChild(e('span', 'slogan', 'OD NÁS S PLNÝM PUPÍKEM'));
    list.appendChild(znacka);

    list.appendChild(e('h1', 'exTitul', f.jedenDen ? 'DNEŠNÍ MENU' : 'JÍDELNÍ LÍSTEK'));
    list.appendChild(
      e('p', 'exTermin', f.jedenDen
        ? NAZVY[stav.denIndex] + ' ' + kratkeDatum(stav.tyden.pondeli, stav.denIndex)
        : rozsahTydne(stav.tyden.pondeli))
    );

    var obsah = e('div', 'exObsah');
    if (f.jedenDen) {
      obsah.appendChild(denDoListu(stav.tyden.dny[stav.denIndex], stav.denIndex, stav.tyden.pondeli, false));
    } else {
      stav.tyden.dny.forEach(function (den, i) {
        obsah.appendChild(denDoListu(den, i, stav.tyden.pondeli, false));
      });
    }
    list.appendChild(obsah);

    if (f.pata) list.appendChild(patickaLetaku(stav.alergeny));

    schranka.appendChild(list);
    document.body.appendChild(schranka);
    return { schranka: schranka, list: list, obsah: obsah };
  }

  /* ------------------------  aby se text vždy vešel  ------------------------ */

  /*
    Půlením intervalu najde největší velikost písma, při které se celý
    lístek ještě vejde do vymezené výšky. Deset kroků stačí na přesnost
    lepší než jedno promile a trvá to pár milisekund – měří se jen
    rozložení stránky, nic se nekreslí.

    Písmo se umí i zvětšit (až na `strop`), aby krátký lístek obrázek
    vyplnil a nekončil v polovině.

    Vrací podíl proti výchozí velikosti, nebo 0, když se lístek nevejde
    ani při nejmenším písmu.
  */
  function prizpusobPismo(obsah, strop) {
    var zaklad = parseFloat(getComputedStyle(obsah).fontSize);
    var nastav = function (podil) { obsah.style.fontSize = zaklad * podil + 'px'; };
    var vejdeSe = function () { return obsah.scrollHeight <= obsah.clientHeight; };

    // Krátký lístek klidně zvětšíme, ať obrázek nekončí poloprázdný.
    nastav(strop);
    if (vejdeSe()) return strop;

    var dole = 0.35;
    var nahore = strop;
    nastav(dole);
    if (!vejdeSe()) return 0; // ani nejmenší písmo nestačí – export.js to ohlásí

    for (var i = 0; i < 10; i++) {
      var stred = (dole + nahore) / 2;
      nastav(stred);
      if (vejdeSe()) dole = stred;
      else nahore = stred;
    }

    nastav(dole);
    return dole;
  }

  /* ---------------------------  převod na obrázek  --------------------------- */

  // Písma se do obrázku musí vložit celá. Spočítá se to jednou a pak se to
  // používá pořád dokola – jinak by se stahovala při každém exportu znovu.
  var pismaCache = null;

  /*
    Knihovna čeká na překreslení okna (requestAnimationFrame). Když se
    prohlížeč mezitím schová – uživatel přepne aplikaci nebo zamkne telefon –
    překreslení se zastaví a export by čekal donekonečna. Proto hlídáme čas
    a radši srozumitelně poradíme, co s tím.
  */
  function sLimitem(slib, sekund) {
    return Promise.race([
      slib,
      new Promise(function (_, zamitni) {
        setTimeout(function () {
          zamitni(
            new Error(
              document.visibilityState === 'hidden'
                ? 'okno se mezitím přepnulo jinam. Nech prosím stránku na obrazovce a zkus to znovu.'
                : 'trvalo to moc dlouho, zkus to prosím znovu.'
            )
          );
        }, sekund * 1000);
      }),
    ]);
  }

  async function naPng(list, f) {
    if (!pismaCache) pismaCache = await sLimitem(htmlToImage.getFontEmbedCSS(list), 30);

    var nastaveni = {
      width: f.sirka,
      height: f.vyska,
      pixelRatio: f.pixely,
      backgroundColor: '#FFFFFF',
      fontEmbedCSS: pismaCache,
    };

    /*
      Kreslí se dvakrát a bere se až druhý výsledek. Safari na iPhonu totiž
      napoprvé občas nestihne načíst vložená písma a vyrobí obrázek se
      systémovým písmem – bez háčků a čárek na správných místech.

      První, zahřívací průchod je schválně v pětinovém rozlišení: písmo se
      načte stejně, ale u letáku to ušetří skoro dvě vteřiny.
    */
    var zahrivaci = Object.assign({}, nastaveni, { pixelRatio: 0.2 });
    await sLimitem(htmlToImage.toPng(list, zahrivaci), 45);
    return sLimitem(htmlToImage.toPng(list, nastaveni), 45);
  }

  /* -----------------------------  stažení  ----------------------------- */

  // Ruční převod místo fetch(dataUrl): fetch na adresu data: by narazil
  // na obsahovou politiku stránky (connect-src 'self').
  function dataUrlNaBlob(dataUrl) {
    var casti = dataUrl.split(',');
    var typ = casti[0].match(/:(.*?);/)[1];
    var binarne = atob(casti[1]);
    var pole = new Uint8Array(binarne.length);
    for (var i = 0; i < binarne.length; i++) pole[i] = binarne.charCodeAt(i);
    return new Blob([pole], { type: typ });
  }

  function stahni(blob, jmeno) {
    var adresa = URL.createObjectURL(blob);
    var odkaz = document.createElement('a');
    odkaz.href = adresa;
    odkaz.download = jmeno;
    document.body.appendChild(odkaz);
    odkaz.click();
    odkaz.remove();
    // Adresu uvolníme až po chvíli, ať se stahování stihne rozběhnout.
    setTimeout(function () { URL.revokeObjectURL(adresa); }, 20000);
  }

  /* -------------------------------  běh  ------------------------------- */

  /**
   * @param {'instagram'|'story'|'letak'} typ
   * @param {{tyden: object, denIndex: number, alergeny: string[]}} stav
   * @param {(text: string) => void} hlas  průběžné hlášení pro uživatele
   */
  async function vyrob(typ, stav, hlas) {
    var f = FORMATY[typ];
    var predloha = postavPredlohu(typ, stav);

    try {
      hlas('Skládám lístek…');
      // Než se měří, musí být písma opravdu načtená – jinak by vyšla
      // jiná výška a zmenšení by sedělo na něco jiného, než se nakreslí.
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      var zmenseni = prizpusobPismo(predloha.obsah, f.strop);

      hlas('Kreslím obrázek…');
      var dataUrl = await naPng(predloha.list, f);

      var zaklad = typ === 'letak' ? 'letak-' : typ === 'story' ? 'menu-' : 'listek-';
      var jmeno = zaklad + stav.tyden.pondeli + (f.jedenDen ? '-' + KODY[stav.denIndex] : '');

      if (typ === 'letak') {
        hlas('Dělám PDF…');
        var jsPDF = window.jspdf.jsPDF;
        var dokument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        dokument.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        stahni(dokument.output('blob'), jmeno + '.pdf');
      } else {
        stahni(dataUrlNaBlob(dataUrl), jmeno + '.png');
      }

      return { jmeno: jmeno, zmenseni: zmenseni };
    } finally {
      // Předlohu uklidíme vždycky, i kdyby se cestou něco pokazilo.
      predloha.schranka.remove();
    }
  }

  window.ugExport = { vyrob: vyrob, formaty: FORMATY };
})();
