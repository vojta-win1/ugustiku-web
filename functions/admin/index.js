/*
  Administrace: /admin

  Nepřihlášenému ukáže přihlašovací obrazovku, přihlášenému editor lístku.
  Týden se vybírá parametrem ?tyden=2026-11-02; bez něj se otevře ten,
  ve kterém jsme dnes.
*/

import { editorHtml, prihlaseniHtml } from '../../lib/admin.js';
import { HLAVICKY_ADMIN, jePrihlasen } from '../../lib/auth.js';
import { dnesVPraze, jePlatneDatum, pondeliTydne, posunDnu } from '../../lib/datum.js';
import { nactiTyden } from '../../lib/db.js';

/** Prázdný týden – když se otevře datum, ke kterému v databázi nic není. */
function prazdnyTyden(pondeli) {
  return {
    pondeli,
    zverejneno: false,
    upravenoV: null,
    dny: [1, 2, 3, 4, 5].map((cislo) => ({ cislo, zavreno: false, poznamka: '', jidla: [] })),
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.DB) {
    return new Response(prihlaseniHtml({ chyba: 'databaze' }), { status: 503, headers: HLAVICKY_ADMIN });
  }

  if (!(await jePrihlasen(env.DB, request))) {
    return new Response(
      prihlaseniHtml({
        chyba: url.searchParams.get('chyba'),
        minut: Number(url.searchParams.get('minut')) || 0,
      }),
      { headers: HLAVICKY_ADMIN }
    );
  }

  // Kterýkoli den v týdnu je platná adresa – vždycky si z něj vezmeme pondělí.
  const zadany = url.searchParams.get('tyden');
  const pondeli = pondeliTydne(jePlatneDatum(zadany) ? zadany : dnesVPraze());

  const data = (await nactiTyden(env.DB, pondeli)) || prazdnyTyden(pondeli);

  return new Response(
    editorHtml({
      data,
      predchozi: posunDnu(pondeli, -7),
      dalsi: posunDnu(pondeli, 7),
    }),
    { headers: HLAVICKY_ADMIN }
  );
}
