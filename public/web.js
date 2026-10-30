/*
  JavaScript veřejné stránky.

  Dvě věci: střídání fotek v úvodu a přepínání dnů v lístku.

  Zásada: stránka musí fungovat i bez tohohle souboru. Záložky dnů a
  tlačítko „Celý týden“ jsou obyčejné odkazy, které si server umí
  obsloužit sám. Skript je jen zrychlí, aby se stránka nemusela
  načítat znovu.
*/
(function () {
  'use strict';

  /* ----------------------------  lístek  ---------------------------- */

  var dny = document.getElementById('dny');
  if (dny) {
    var KODY = ['po', 'ut', 'st', 'ct', 'pa'];
    var sekce = [].slice.call(dny.querySelectorAll('.den'));
    var zalozky = [].slice.call(document.querySelectorAll('.tab'));
    var denpres = document.getElementById('denpres');
    var prepinac = document.getElementById('prepinac');
    var sipky = [].slice.call(document.querySelectorAll('.sipka'));

    var aktivni = Math.max(0, sekce.findIndex(function (s) { return s.classList.contains('aktivni'); }));
    var celyTyden = !dny.classList.contains('jeden');

    // Jídla mají v CSS animaci, která se spustí jen jednou. Při přepnutí
    // dne ji musíme nastartovat znovu – proto to krátké vypnutí a zapnutí.
    function rozhybej(prvek) {
      prvek.querySelectorAll('.dish').forEach(function (el) {
        el.style.animation = 'none';
        void el.offsetWidth; // vynutí překreslení, jinak si prohlížeč změny spojí dohromady
        el.style.animation = '';
      });
    }

    function nastavSipku(sipka, cil) {
      if (cil < 0 || cil > 4) {
        sipka.removeAttribute('href');
        sipka.setAttribute('aria-disabled', 'true');
      } else {
        sipka.setAttribute('href', '?den=' + KODY[cil] + '#listek');
        sipka.removeAttribute('aria-disabled');
      }
    }

    function vykresli() {
      dny.classList.toggle('jeden', !celyTyden);
      if (denpres) denpres.hidden = celyTyden;

      sekce.forEach(function (s, i) {
        s.classList.toggle('aktivni', i === aktivni);
      });
      zalozky.forEach(function (z, i) {
        if (i === aktivni && !celyTyden) z.setAttribute('aria-current', 'page');
        else z.removeAttribute('aria-current');
        z.setAttribute('href', '?den=' + KODY[i] + '#listek');
      });

      sipky.forEach(function (s) {
        nastavSipku(s, s.getAttribute('data-sipka') === 'zpet' ? aktivni - 1 : aktivni + 1);
      });

      if (prepinac) {
        prepinac.textContent = celyTyden ? 'Zobrazit jeden den' : 'Celý týden';
        prepinac.setAttribute('href', celyTyden ? '?den=' + KODY[aktivni] + '#listek' : '?tyden=cely#listek');
      }

      if (!celyTyden) rozhybej(sekce[aktivni]);
      else sekce.forEach(rozhybej);
    }

    function zapisAdresu() {
      var adresa = celyTyden ? '?tyden=cely' : '?den=' + KODY[aktivni];
      history.pushState({ den: aktivni, cely: celyTyden }, '', adresa);
    }

    function prepni(index, cely) {
      aktivni = Math.min(4, Math.max(0, index));
      celyTyden = !!cely;
      vykresli();
    }

    zalozky.forEach(function (z, i) {
      z.addEventListener('click', function (e) {
        e.preventDefault();
        prepni(i, false);
        zapisAdresu();
      });
    });

    sipky.forEach(function (s) {
      s.addEventListener('click', function (e) {
        if (s.getAttribute('aria-disabled') === 'true') return;
        e.preventDefault();
        prepni(s.getAttribute('data-sipka') === 'zpet' ? aktivni - 1 : aktivni + 1, false);
        zapisAdresu();
      });
    });

    if (prepinac) {
      prepinac.addEventListener('click', function (e) {
        e.preventDefault();
        prepni(aktivni, !celyTyden);
        zapisAdresu();
      });
    }

    // Tlačítko Zpět v prohlížeči má fungovat jako kdekoliv jinde.
    window.addEventListener('popstate', function (e) {
      var s = e.state;
      if (s && typeof s.den === 'number') prepni(s.den, s.cely);
    });

    // Šipky na klávesnici, když je kurzor na záložkách.
    var tabsEl = document.getElementById('tabs');
    if (tabsEl) {
      tabsEl.addEventListener('keydown', function (e) {
        var smer = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!smer) return;
        e.preventDefault();
        var cil = (aktivni + smer + 5) % 5;
        prepni(cil, false);
        zapisAdresu();
        zalozky[cil].focus();
      });
    }

    vykresli();
  }

  /* --------------------  legenda alergenů  -------------------- */

  var algbtn = document.getElementById('algbtn');
  var alglist = document.getElementById('alglist');
  if (algbtn && alglist) {
    algbtn.addEventListener('click', function () {
      var otevrit = alglist.hidden;
      alglist.hidden = !otevrit;
      algbtn.setAttribute('aria-expanded', otevrit ? 'true' : 'false');
      algbtn.textContent = otevrit ? 'Skrýt seznam alergenů' : 'Co znamenají čísla alergenů?';
    });
  }

  /* --------------------  fotky v úvodu  -------------------- */

  var slides = document.querySelectorAll('.hero .slide');
  var bars = document.getElementById('bars');
  var cap = document.getElementById('cap');
  if (slides.length && bars && cap) {
    // Krátké popisky pod ukazatelem. Schválně nejsou z atributu alt –
    // ten je delší, protože popisuje fotku pro čtečku obrazovky.
    // Když se vymění fotky v návrhu, uprav i tenhle seznam.
    var popisky = ['Domácí bábovka', 'Housky se sekanou', 'Bagety do ruky'];
    if (popisky.length !== slides.length) {
      popisky = [].map.call(slides, function (s) { return s.getAttribute('alt') || ''; });
    }
    var SEKUND = 5.5;
    var cur = 0;
    var timer = null;

    bars.innerHTML = popisky
      .map(function (c, i) {
        return '<button type="button" aria-label="Fotka ' + (i + 1) + ': ' + c + '"><span class="track"><span class="fill"></span></span></button>';
      })
      .join('');
    var fills = bars.querySelectorAll('.fill');

    function ukaz(i) {
      cur = i;
      slides.forEach(function (s, j) { s.classList.toggle('on', j === i); });
      cap.textContent = popisky[i];
      fills.forEach(function (f) { f.style.transition = 'none'; f.style.width = '0'; });
      void bars.offsetWidth;
      fills[i].style.transition = 'width ' + SEKUND + 's linear';
      fills[i].style.width = '100%';
    }
    function spust() {
      clearInterval(timer);
      timer = setInterval(function () { ukaz((cur + 1) % slides.length); }, SEKUND * 1000);
    }

    bars.querySelectorAll('button').forEach(function (b, i) {
      b.addEventListener('click', function () { ukaz(i); spust(); });
    });

    ukaz(0);
    spust();
  }
})();
