/*
  Editor jídelního lístku.

  Jak to funguje:
    – Data týdne přijdou už ve stránce (značka <script id="data">),
      takže editor naskočí hned, bez dalšího dotazu na server.
    – Všechny úpravy se dějí nad objektem `tyden` v paměti. Když se něco
      změní, 0,8 vteřiny se počká (kdyby uživatel psal dál) a pak se celý
      týden uloží. Nic se nepotvrzuje tlačítkem, aby se nedalo o práci přijít.
    – Při psaní se stránka schválně NEvykresluje znovu – jinak by uživateli
      utekl kurzor z políčka. Překresluje se až při přidání, smazání,
      posunutí jídla nebo přepnutí dne.
*/
(function () {
  'use strict';

  var zdroj = JSON.parse(document.getElementById('data').textContent);
  var ALERGENY = zdroj.alergeny;
  var tyden = zdroj.tyden;

  var NAZVY = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
  var ZKRATKY = ['Po', 'Út', 'St', 'Čt', 'Pá'];
  var KODY = ['po', 'ut', 'st', 'ct', 'pa'];

  var aktivni = 0;
  var zmeneno = false;
  var uklada = false;
  var cekaDalsi = false;
  var casovac = null;

  /* ------------------------  drobné pomůcky  ------------------------ */

  function e(znacka, vlastnosti) {
    var prvek = document.createElement(znacka);
    var v = vlastnosti || {};
    for (var k in v) {
      if (k === 'text') prvek.textContent = v[k];
      else if (k === 'html') prvek.innerHTML = v[k];
      else if (k === 'trida') prvek.className = v[k];
      else if (k.slice(0, 2) === 'on') prvek.addEventListener(k.slice(2), v[k]);
      else if (v[k] === true) prvek.setAttribute(k, '');
      else if (v[k] !== false && v[k] != null) prvek.setAttribute(k, v[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var d = arguments[i];
      if (d == null || d === false) continue;
      prvek.appendChild(typeof d === 'string' ? document.createTextNode(d) : d);
    }
    return prvek;
  }

  function datumDne(index) {
    var d = new Date(tyden.pondeli + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + index);
    return d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '.';
  }

  var maObsah = function (den) { return den.jidla.length > 0; };

  /* ---------------------------  ukládání  --------------------------- */

  var stavUlozeni = document.getElementById('ulozeno');

  function ukazStav(text, trida) {
    stavUlozeni.textContent = text;
    stavUlozeni.className = 'ulozeno' + (trida ? ' ' + trida : '');
  }

  function oznacZmenu() {
    zmeneno = true;
    ukazStav('Neuloženo…');
    clearTimeout(casovac);
    casovac = setTimeout(uloz, 800);
  }

  async function posli(cesta, nastaveni) {
    var odpoved = await fetch(cesta, nastaveni);
    var data;
    try {
      data = await odpoved.json();
    } catch (chyba) {
      throw new Error('Server odpověděl nesrozumitelně.');
    }
    if (!odpoved.ok) throw new Error(data.chyba || 'Něco se nepovedlo.');
    return data;
  }

  async function uloz() {
    // Když ukládání zrovna běží, počkáme a pustíme další hned po něm.
    if (uklada) {
      cekaDalsi = true;
      return;
    }
    clearTimeout(casovac);
    uklada = true;
    zmeneno = false;
    ukazStav('Ukládám…', 'uklada');

    try {
      var data = await posli('/api/tyden/' + tyden.pondeli, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dny: tyden.dny }),
        // keepalive: ukládání doběhne, i když uživatel mezitím stránku zavře
        keepalive: true,
      });
      /*
        Z odpovědi si schválně nebereme jídla zpátky – uživatel mohl mezitím
        psát dál a přepsali bychom mu rozepsané. Stačí stav zveřejnění.
      */
      tyden.zverejneno = data.tyden.zverejneno;
      ukazStav(tyden.zverejneno ? 'Uloženo ✓ · změny jsou na webu' : 'Uloženo ✓');
      vykresliStavTydne();
      obnovNahled();
    } catch (chyba) {
      zmeneno = true;
      ukazStav(chyba.message, 'chyba');
    } finally {
      uklada = false;
      if (cekaDalsi) {
        cekaDalsi = false;
        oznacZmenu();
      }
    }
  }

  /* ----------------------------  náhled  ---------------------------- */

  var nahled = document.getElementById('nahled');

  function obnovNahled() {
    var adresa = '/admin/nahled/' + tyden.pondeli + '?den=' + KODY[aktivni];
    try {
      // replace místo přiřazení src: v rámečku se tím nehromadí historie
      nahled.contentWindow.location.replace(adresa);
    } catch (chyba) {
      nahled.src = adresa;
    }
  }

  /* -------------------------  stav týdne  ------------------------- */

  var stavTydne = document.getElementById('stav-tydne');
  var tlacitkoZverejnit = document.getElementById('zverejnit');

  function vykresliStavTydne() {
    stavTydne.innerHTML = '';
    stavTydne.appendChild(
      e('span', {
        trida: 'odznak ' + (tyden.zverejneno ? 'venku' : 'koncept'),
        text: tyden.zverejneno ? 'Na webu' : 'Koncept',
      })
    );
    tlacitkoZverejnit.textContent = tyden.zverejneno ? 'Stáhnout z webu' : 'Zveřejnit na webu';
    tlacitkoZverejnit.classList.toggle('hlavni', !tyden.zverejneno);
    tlacitkoZverejnit.classList.toggle('nebezpecne', tyden.zverejneno);
  }

  tlacitkoZverejnit.addEventListener('click', async function () {
    var stahujeme = tyden.zverejneno;
    if (stahujeme && !confirm('Opravdu stáhnout lístek z webu? Hosté pak uvidí hlášku, že lístek zatím není zveřejněný.')) {
      return;
    }
    // Před zveřejněním ať je jistě uložené všechno rozepsané.
    if (zmeneno) await uloz();

    tlacitkoZverejnit.disabled = true;
    try {
      var data = await posli('/api/tyden/' + tyden.pondeli, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ akce: stahujeme ? 'skryt' : 'zverejnit' }),
      });
      tyden = data.tyden;
      ukazStav(stahujeme ? 'Lístek je stažený z webu.' : 'Hotovo, lístek je na webu.');
      vykresliStavTydne();
      obnovNahled();
    } catch (chyba) {
      ukazStav(chyba.message, 'chyba');
    } finally {
      tlacitkoZverejnit.disabled = false;
    }
  });

  document.getElementById('kopirovat').addEventListener('click', async function () {
    if (!confirm('Zkopírovat jídla z minulého týdne? Co je teď v tomhle týdnu napsané, se přepíše.')) return;

    var tlacitko = this;
    tlacitko.disabled = true;
    try {
      var data = await posli('/api/tyden/' + tyden.pondeli, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ akce: 'kopirovat-minuly' }),
      });
      tyden = data.tyden;
      zmeneno = false;
      ukazStav('Minulý týden zkopírován. Teď ho uprav.');
      vykresliVse();
      obnovNahled();
    } catch (chyba) {
      ukazStav(chyba.message, 'chyba');
    } finally {
      tlacitko.disabled = false;
    }
  });

  /* --------------------------  záložky dnů  -------------------------- */

  var pasDnu = document.getElementById('adny');

  function vykresliDny() {
    pasDnu.innerHTML = '';
    NAZVY.forEach(function (nazev, i) {
      var den = tyden.dny[i];
      var tridy = 'aden' + (den.zavreno ? ' zavreno' : maObsah(den) ? ' maobsah' : '');
      pasDnu.appendChild(
        e(
          'button',
          {
            type: 'button',
            trida: tridy,
            'aria-pressed': i === aktivni ? 'true' : 'false',
            'aria-label': nazev + ' ' + datumDne(i),
            onclick: function () {
              aktivni = i;
              vykresliDny();
              vykresliEditor();
              obnovNahled();
            },
          },
          e('span', { text: ZKRATKY[i], 'aria-hidden': true }),
          e('span', { trida: 'tecka', 'aria-hidden': true })
        )
      );
    });
  }

  /* --------------------------  editor dne  -------------------------- */

  var editor = document.getElementById('editor');

  function vypinac(popis, zaskrtnuto, priZmene) {
    var vstup = e('input', { type: 'checkbox', onchange: function () { priZmene(this.checked); } });
    if (zaskrtnuto) vstup.checked = true;
    return e('label', { trida: 'vypinac' }, vstup, e('span', { trida: 'draha', 'aria-hidden': true }), popis);
  }

  function poleText(popis, hodnota, priZmene, nastaveni) {
    var n = nastaveni || {};
    var vstup = e('input', {
      type: n.cislo ? 'number' : 'text',
      value: hodnota,
      inputmode: n.cislo ? 'numeric' : null,
      min: n.cislo ? '0' : null,
      maxlength: n.cislo ? null : '200',
      placeholder: n.napoveda || null,
      oninput: function () { priZmene(this.value); },
    });
    return e('label', { trida: 'pole' + (n.cislo ? ' cena' : '') }, e('span', { text: popis }), vstup);
  }

  function kartaJidla(jidlo, index, den) {
    var hlava = e('div', { trida: 'jhlava' });

    // volba typu – polévka nebo hlavní chod
    var volba = e('div', { trida: 'typ' });
    [['polevka', 'Polévka'], ['hlavni', 'Hlavní chod']].forEach(function (par) {
      var vstup = e('input', {
        type: 'radio',
        name: 'typ-' + den.cislo + '-' + index,
        onchange: function () {
          jidlo.typ = par[0];
          oznacZmenu();
          vykresliEditor();
        },
      });
      if (jidlo.typ === par[0]) vstup.checked = true;
      volba.appendChild(e('label', {}, vstup, par[1]));
    });
    hlava.appendChild(volba);

    var nastroje = e('div', { trida: 'jnastroje' });
    nastroje.appendChild(
      e('button', {
        type: 'button', trida: 'atlac drobne', 'aria-label': 'Posunout nahoru', text: '↑',
        disabled: index === 0,
        onclick: function () { prohod(den, index, index - 1); },
      })
    );
    nastroje.appendChild(
      e('button', {
        type: 'button', trida: 'atlac drobne', 'aria-label': 'Posunout dolů', text: '↓',
        disabled: index === den.jidla.length - 1,
        onclick: function () { prohod(den, index, index + 1); },
      })
    );
    nastroje.appendChild(
      e('button', {
        type: 'button', trida: 'atlac drobne nebezpecne', 'aria-label': 'Smazat jídlo', text: '✕',
        onclick: function () {
          if (jidlo.nazev && !confirm('Opravdu smazat „' + jidlo.nazev + '“?')) return;
          den.jidla.splice(index, 1);
          oznacZmenu();
          vykresliVse();
        },
      })
    );
    hlava.appendChild(nastroje);

    // alergeny
    var mrizka = e('div', { trida: 'alergeny' });
    var shrnuti = e('summary');
    function popisAlergenu() {
      shrnuti.textContent = jidlo.alergeny.length
        ? 'Alergeny: ' + jidlo.alergeny.join(', ')
        : 'Alergeny: žádné';
    }
    ALERGENY.forEach(function (nazev, i) {
      var cislo = String(i + 1);
      var vstup = e('input', {
        type: 'checkbox',
        onchange: function () {
          if (this.checked) jidlo.alergeny.push(cislo);
          else jidlo.alergeny = jidlo.alergeny.filter(function (a) { return a !== cislo; });
          jidlo.alergeny.sort(function (a, b) { return a - b; });
          popisAlergenu();
          oznacZmenu();
        },
      });
      if (jidlo.alergeny.indexOf(cislo) !== -1) vstup.checked = true;
      mrizka.appendChild(e('label', {}, vstup, cislo + ' · ' + nazev));
    });
    popisAlergenu();

    return e(
      'article',
      { trida: 'jidlo ' + jidlo.typ },
      hlava,
      poleText('Název jídla', jidlo.nazev, function (v) { jidlo.nazev = v; oznacZmenu(); }, {
        napoveda: 'Například Svíčková na smetaně',
      }),
      poleText('Cena v Kč', jidlo.cena, function (v) { jidlo.cena = v === '' ? 0 : parseInt(v, 10) || 0; oznacZmenu(); }, { cislo: true }),
      vypinac('Bez masa', jidlo.bezMasa, function (zap) { jidlo.bezMasa = zap; oznacZmenu(); }),
      e('details', { trida: 'alergenybox' }, shrnuti, mrizka)
    );
  }

  function prohod(den, odkud, kam) {
    var jidlo = den.jidla[odkud];
    den.jidla[odkud] = den.jidla[kam];
    den.jidla[kam] = jidlo;
    oznacZmenu();
    vykresliVse();
  }

  function vykresliEditor() {
    var den = tyden.dny[aktivni];
    editor.innerHTML = '';

    editor.appendChild(e('h2', { trida: 'display', text: NAZVY[aktivni] + ' ' + datumDne(aktivni) }));

    // zavřeno + poznámka
    var zavrenoBox = e(
      'div',
      { trida: 'zavrenobox' },
      vypinac('Zavřeno', den.zavreno, function (zap) {
        den.zavreno = zap;
        oznacZmenu();
        vykresliVse();
      })
    );
    if (den.zavreno) {
      zavrenoBox.appendChild(
        poleText('Poznámka pro hosty', den.poznamka, function (v) { den.poznamka = v; oznacZmenu(); }, {
          napoveda: 'Například Státní svátek – zavřeno',
        })
      );
    }
    editor.appendChild(zavrenoBox);

    if (den.zavreno) {
      editor.appendChild(
        e('p', {
          trida: 'prazdnyden',
          text: den.jidla.length
            ? 'Tenhle den je zavřený, jídla se na webu neukážou. Zůstávají ale uložená – až zavřeno vypneš, budou zase tady.'
            : 'Tenhle den je zavřený. Hostům se ukáže jen poznámka.',
        })
      );
      return;
    }

    if (!den.jidla.length) {
      editor.appendChild(e('p', { trida: 'prazdnyden', text: 'Na tenhle den zatím není žádné jídlo.' }));
    }

    den.jidla.forEach(function (jidlo, i) {
      editor.appendChild(kartaJidla(jidlo, i, den));
    });

    editor.appendChild(
      e('button', {
        type: 'button',
        trida: 'atlac hlavni',
        text: '+ Přidat jídlo',
        onclick: function () {
          // První jídlo dne bývá polévka – nabídneme ji rovnou.
          var maPolevku = den.jidla.some(function (j) { return j.typ === 'polevka'; });
          den.jidla.push({
            typ: maPolevku ? 'hlavni' : 'polevka',
            nazev: '',
            cena: maPolevku ? 170 : 45,
            alergeny: [],
            bezMasa: false,
          });
          oznacZmenu();
          vykresliVse();
          // Kurzor rovnou do názvu nového jídla, ať se dá hned psát.
          var policka = editor.querySelectorAll('.jidlo input[type="text"]');
          if (policka.length) policka[policka.length - 1].focus();
        },
      })
    );
  }

  function vykresliVse() {
    vykresliDny();
    vykresliEditor();
    vykresliStavTydne();
  }

  /* --------------------  přepínač Upravit / Náhled  -------------------- */

  var sloupce = document.getElementById('sloupce');
  var tlacitkaRezimu = {
    upravit: document.getElementById('rezim-upravit'),
    nahled: document.getElementById('rezim-nahled'),
  };

  Object.keys(tlacitkaRezimu).forEach(function (rezim) {
    tlacitkaRezimu[rezim].addEventListener('click', function () {
      sloupce.setAttribute('data-rezim', rezim);
      tlacitkaRezimu.upravit.setAttribute('aria-pressed', String(rezim === 'upravit'));
      tlacitkaRezimu.nahled.setAttribute('aria-pressed', String(rezim === 'nahled'));
      if (rezim === 'nahled') {
        // Ať se nekouká na náhled, ve kterém ještě není poslední změna.
        if (zmeneno) uloz();
        else obnovNahled();
      }
    });
  });

  /* ---------------------  pojistky proti ztrátě  --------------------- */

  window.addEventListener('beforeunload', function (udalost) {
    if (!zmeneno && !uklada) return;
    udalost.preventDefault();
    udalost.returnValue = '';
  });

  /*
    Na mobilu se stránka často jen „odloží“ (přepnutí aplikace, zamčení
    telefonu) a beforeunload se nespustí. Tohle je proto důležitější
    pojistka než ta předchozí.
  */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && zmeneno) uloz();
  });

  /* ----------------------------  start  ---------------------------- */

  vykresliVse();
  ukazStav(tyden.zverejneno ? 'Lístek je na webu, změny se projeví hned.' : 'Koncept – zatím ho nikdo nevidí.');
  obnovNahled();
})();
