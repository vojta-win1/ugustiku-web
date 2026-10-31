/*
  Přihlášení: POST /api/prihlaseni

  Je to obyčejný formulář, ne volání z JavaScriptu – aby přihlášení
  fungovalo i kdyby JavaScript selhal. Odpovědí je přesměrování zpátky
  na /admin, případně s popisem chyby v adrese.
*/

import {
  adresaZadatele,
  overHeslo,
  pochaziZNaseho,
  smazPokusy,
  zalozRelaci,
  zapisNeuspech,
  zbyvaBlokace,
} from '../../lib/auth.js';

function presmeruj(kam, cookie = null) {
  const hlavicky = new Headers({ location: kam, 'cache-control': 'no-store' });
  if (cookie) hlavicky.set('set-cookie', cookie);
  // 303 říká prohlížeči: po odeslání formuláře načti cílovou stránku jako GET.
  return new Response(null, { status: 303, headers: hlavicky });
}

export async function onRequestPost({ request, env }) {
  if (!pochaziZNaseho(request)) return presmeruj('/admin?chyba=cizi');
  if (!env.DB) return presmeruj('/admin?chyba=databaze');

  const ip = adresaZadatele(request);

  const blokace = await zbyvaBlokace(env.DB, ip);
  if (blokace > 0) return presmeruj(`/admin?chyba=blokace&minut=${blokace}`);

  const formular = await request.formData();
  const heslo = String(formular.get('heslo') || '');

  const ulozeny = env.ADMIN_HESLO_HASH;
  if (!ulozeny) {
    console.error('Chybí secret ADMIN_HESLO_HASH – přihlásit se nedá.');
    return presmeruj('/admin?chyba=nastaveni');
  }

  if (!(await overHeslo(heslo, ulozeny))) {
    await zapisNeuspech(env.DB, ip);
    const zbyva = await zbyvaBlokace(env.DB, ip);
    return presmeruj(zbyva > 0 ? `/admin?chyba=blokace&minut=${zbyva}` : '/admin?chyba=heslo');
  }

  await smazPokusy(env.DB, ip);
  const cookie = await zalozRelaci(env.DB, request);
  return presmeruj('/admin', cookie);
}
